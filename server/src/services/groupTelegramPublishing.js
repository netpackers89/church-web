import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { sendTelegramNotification } from '../telegram/services/messaging.js';

export function telegramGroupDestination(group) {
  if (group.telegramType === 'none') return null;
  const candidates = [
    group.telegramUsername ? `https://t.me/${String(group.telegramUsername).replace(/^@/, '')}` : null,
    group.telegramPublicLink,
    ...(Array.isArray(group.communityLinks)
      ? group.communityLinks
        .filter((link) => String(link?.platform).toLowerCase() === 'telegram' && link.enabled !== false)
        .map((link) => link.url)
      : []),
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || !['t.me', 'telegram.me', 'www.t.me'].includes(url.hostname.toLowerCase())) continue;
      const parts = url.pathname.split('/').filter(Boolean);
      const username = parts.length === 1 ? parts[0] : parts.length === 2 && parts[0] === 's' ? parts[1] : '';
      if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) {
        return { chatId: `@${username}`, url: `https://t.me/${username}` };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function splitMessage(value, limit) {
  const chunks = [];
  let remaining = value.trim();
  while (remaining.length > limit) {
    let splitAt = remaining.lastIndexOf('\n', limit);
    if (splitAt < Math.floor(limit * 0.6)) splitAt = remaining.lastIndexOf(' ', limit);
    if (splitAt < Math.floor(limit * 0.6)) splitAt = limit;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function claimDelivery({ post, groupId, groupType, destination, retry }) {
  if (retry) {
    const updated = await pool.query(
      `UPDATE group_telegram_deliveries
       SET status='PENDING',destination=$2,attempt_count=attempt_count+1,error_message=NULL,updated_at=NOW()
       WHERE post_id=$1 AND status='FAILED'
       RETURNING telegram_message_ids AS "messageIds"`,
      [post.id, destination],
    );
    if (updated.rowCount) return updated;
    const existing = await pool.query(
      `SELECT status,telegram_message_ids AS "messageIds",error_message AS error
       FROM group_telegram_deliveries WHERE post_id=$1`,
      [post.id],
    );
    return { ...existing, alreadyProcessed: true };
  }
  const inserted = await pool.query(
    `INSERT INTO group_telegram_deliveries(post_id,group_id,group_type,destination)
     VALUES($1,$2,$3,$4) ON CONFLICT(post_id) DO NOTHING
     RETURNING telegram_message_ids AS "messageIds"`,
    [post.id, groupId, groupType, destination],
  );
  if (inserted.rowCount) return inserted;
  const existing = await pool.query(
    `SELECT status,telegram_message_ids AS "messageIds",error_message AS error
     FROM group_telegram_deliveries WHERE post_id=$1`,
    [post.id],
  );
  return { ...existing, alreadyProcessed: true };
}

export async function setGroupTelegramConnectionStatus(groupType, groupId, connected, errorMessage = null) {
  const table = groupType === 'department' ? 'departments' : 'bible_study_groups';
  const statusType = groupType === 'department' ? 'department_connection_status' : 'group_connection_status';
  await pool.query(
    `UPDATE ${table}
     SET telegram_connection_status=$2::${statusType},telegram_verified_at=CASE WHEN $2='CONNECTED' THEN NOW() ELSE telegram_verified_at END,
         telegram_verify_error=$3,updated_at=NOW()
     WHERE id=$1`,
    [groupId, connected ? 'CONNECTED' : 'ERROR', errorMessage?.slice(0, 1000) ?? null],
  );
}

export async function publishGroupPostToTelegram({ post, group, groupType, retry = false, viewUrl, viewLabel = 'View post' }) {
  const destination = telegramGroupDestination(group);
  if (!destination) {
    const message = 'Configure a public Telegram username or public group/channel link before publishing to Telegram. Invite links are for members to join and cannot be used as bot destinations.';
    if (retry) {
      await pool.query(
        `UPDATE group_telegram_deliveries SET status='FAILED',error_message=$2,updated_at=NOW() WHERE post_id=$1`,
        [post.id, message],
      );
    } else {
      await pool.query(
        `INSERT INTO group_telegram_deliveries(post_id,group_id,group_type,destination,status,error_message)
         VALUES($1,$2,$3,'not-configured','FAILED',$4)
         ON CONFLICT(post_id) DO NOTHING`,
        [post.id, group.id, groupType, message],
      );
    }
    await setGroupTelegramConnectionStatus(groupType, group.id, false, message);
    return { status: 'FAILED', error: message };
  }

  const claim = await claimDelivery({
    post,
    groupId: group.id,
    groupType,
    destination: destination.chatId,
    retry,
  });
  if (claim.alreadyProcessed) {
    if (claim.rows[0]?.status === 'SENT') return { status: 'SENT', alreadyDelivered: true };
    if (claim.rows[0]?.status === 'PENDING') return { status: 'PENDING', message: 'Telegram delivery is already in progress.' };
    return { status: claim.rows[0]?.status ?? 'NOT_FOUND', error: claim.rows[0]?.error };
  }

  const targetUrl = viewUrl || new URL(
    `${groupType === 'department' ? '/community/departments' : '/community/bible-study-groups'}/${group.id}#post-${post.id}`,
    config.webOrigin,
  ).href;
  const buttons = [{ text: viewLabel, url: targetUrl }];
  const text = `${group.name}\n\n${post.title}\n\n${post.body}`.trim();
  const photoUrl = post.imageUrl || (Array.isArray(post.imageUrls) ? post.imageUrls[0] : null);
  const messageIds = [];
  async function send({ messageText, photo, includeButton }, partIndex) {
    await pool.query(
      `INSERT INTO group_telegram_delivery_parts(post_id,part_index,status)
       VALUES($1,$2,'PENDING') ON CONFLICT(post_id,part_index) DO NOTHING`,
      [post.id, partIndex],
    );
    const part = await pool.query(
      `SELECT status,telegram_message_id AS "messageId"
       FROM group_telegram_delivery_parts WHERE post_id=$1 AND part_index=$2`,
      [post.id, partIndex],
    );
    if (part.rows[0]?.status === 'SENT') {
      messageIds.push(part.rows[0].messageId);
      return;
    }
    const delivered = await sendTelegramNotification({
      chatId: destination.chatId,
      text: messageText,
      ...(photo ? { photoUrl: photo } : {}),
      buttons: includeButton ? buttons : undefined,
    });
    await pool.query(
      `UPDATE group_telegram_delivery_parts SET status='SENT',telegram_message_id=$3,updated_at=NOW()
       WHERE post_id=$1 AND part_index=$2`,
      [post.id, partIndex, delivered.messageId],
    );
    messageIds.push(delivered.messageId);
    await pool.query(
      `UPDATE group_telegram_deliveries SET telegram_message_ids=$2::jsonb,updated_at=NOW() WHERE post_id=$1`,
      [post.id, JSON.stringify(messageIds)],
    );
  }

  try {
    const parts = [];
    if (photoUrl) {
      const [caption, ...remainder] = splitMessage(text, 1024);
      parts.push({ messageText: caption || group.name, photo: photoUrl, includeButton: remainder.length === 0 });
      remainder.forEach((messageText, index) => parts.push({
        messageText,
        includeButton: index === remainder.length - 1,
      }));
    } else {
      splitMessage(text, 4096).forEach((messageText, index, chunks) => parts.push({
        messageText,
        includeButton: index === chunks.length - 1,
      }));
    }
    for (let index = 0; index < parts.length; index += 1) await send(parts[index], index);
    const deliveredParts = await pool.query(
      `SELECT telegram_message_id AS "messageId" FROM group_telegram_delivery_parts
       WHERE post_id=$1 AND status='SENT' ORDER BY part_index`,
      [post.id],
    );
    messageIds.splice(0, messageIds.length, ...deliveredParts.rows.map((part) => part.messageId));
    await pool.query(
      `UPDATE group_telegram_deliveries SET telegram_message_ids=$2::jsonb,updated_at=NOW() WHERE post_id=$1`,
      [post.id, JSON.stringify(messageIds)],
    );
    await pool.query(
      `UPDATE group_telegram_deliveries
       SET status='SENT',error_message=NULL,delivered_at=NOW(),updated_at=NOW() WHERE post_id=$1`,
      [post.id],
    );
    await setGroupTelegramConnectionStatus(groupType, group.id, true);
    return { status: 'SENT', destination: destination.chatId, messageIds };
  } catch (error) {
    await pool.query(
      `UPDATE group_telegram_deliveries SET status='FAILED',error_message=$2,updated_at=NOW() WHERE post_id=$1`,
      [post.id, error.message.slice(0, 1000)],
    );
    await setGroupTelegramConnectionStatus(groupType, group.id, false, error.message);
    console.error('[group telegram publishing] delivery failed:', error.message);
    return { status: 'FAILED', destination: destination.chatId, error: error.message };
  }
}
