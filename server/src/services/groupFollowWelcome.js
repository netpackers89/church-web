import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { sendEmailNotification } from '../email/index.js';
import { sendTelegramNotification } from '../telegram/services/messaging.js';
import { telegramText } from '../telegram/templates/localization.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function safeTelegramLink(group) {
  const links = [
    ...(Array.isArray(group.communityLinks)
      ? group.communityLinks.filter((link) => String(link?.platform).toLowerCase() === 'telegram' && link.enabled === true).map((link) => link.url)
      : []),
    group.telegramPublicLink,
    group.telegramInviteLink,
  ];
  for (const candidate of links) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'https:' && ['t.me', 'telegram.me'].includes(url.hostname.toLowerCase())) return url.href;
    } catch {
      continue;
    }
  }
  return null;
}

export async function sendGroupFollowWelcome({ userId, group, groupType }) {
  const [userResult, preferencesResult] = await Promise.all([
    pool.query(
      `SELECT u.id,u.name,u.email,u.telegram_chat_id,u.notify_email,u.notify_telegram,
              (SELECT ta.language_code FROM telegram_accounts ta WHERE ta.user_id=u.id
               ORDER BY ta.linked_at DESC NULLS LAST LIMIT 1) AS "telegramLanguage"
       FROM users u WHERE u.id=$1`,
      [userId],
    ),
    pool.query(`SELECT email_enabled AS "emailEnabled",telegram_enabled AS "telegramEnabled",in_app_enabled AS "inAppEnabled"
      FROM group_notification_preferences WHERE user_id=$1 AND group_id=$2 AND group_type=$3`, [userId, group.id, groupType]),
  ]);
  const user = userResult.rows[0];
  if (!user) return { email: 'SKIPPED', telegram: 'SKIPPED', inApp: 'SKIPPED' };
  const preferences = preferencesResult.rows[0] ?? { emailEnabled: true, telegramEnabled: true, inAppEnabled: true };
  const delivery = { email: 'SKIPPED', telegram: 'SKIPPED', inApp: 'SKIPPED' };
  const path = groupType === 'department' ? `/community/departments/${group.id}` : `/community/bible-study-groups/${group.id}`;
  const absoluteLink = new URL(path, config.webOrigin).href;
  const telegramLink = safeTelegramLink(group);
  const scheduleLine = group.meetingSchedule ? `Meeting: ${group.meetingSchedule}` : '';
  const locationLine = group.locationText ? `Location: ${group.locationText}` : '';
  const detailText = [scheduleLine, locationLine].filter(Boolean).join('\n');
  const externalGroupNote = telegramLink
    ? '\nFollowing here does not automatically join the external Telegram group. Use the button below if you would like to join it.'
    : '';

  if (preferences.inAppEnabled) {
    const result = await pool.query(
      `INSERT INTO user_notifications(user_id,type,title,body,link_url,notification_status,email_status)
       VALUES($1,'GROUP_FOLLOW',$2,$3,$4,'PENDING','SKIPPED')`,
      [userId, `Welcome to ${group.name}`, [`You are now following ${group.name}. Group updates will appear in your member portal.`, detailText, telegramLink ? `Join the group on Telegram: ${telegramLink}` : ''].filter(Boolean).join('\n\n'), path]
    );
    if (result.rowCount) await recordDelivery(userId, group, groupType, 'in_app', 'SENT');
  } else {
    await recordDelivery(userId, group, groupType, 'in_app', 'SKIPPED');
  }

  const emailOn = preferences.emailEnabled && Boolean(user.email);
  if (emailOn) {
    delivery.email = await deliver(userId, group, groupType, 'email', async () =>
      sendEmailNotification({
        to: user.email,
        subject: `Welcome to ${group.name} — ${config.branding.churchName}`,
        text: `Hello ${user.name || 'friend'},\n\nYou are now following ${group.name}. Group updates will appear in your member portal.\n\n${detailText ? `${detailText}\n\n` : ''}View the group: ${absoluteLink}${telegramLink ? `${externalGroupNote}\n${telegramLink}` : ''}`,
        html: `<div style="margin:0;background:#f1f5f9;padding:28px 12px;font-family:Arial,sans-serif;color:#172033"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><div style="padding:26px"><p style="margin:0 0 8px;color:#106eb6;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escapeHtml(config.branding.churchName)}</p><h1 style="margin:0 0 12px;font-size:24px">Welcome to ${escapeHtml(group.name)}</h1><p style="line-height:1.6;color:#475569">Hello ${escapeHtml(user.name || 'friend')}, you are now following this group. New updates will appear in your member portal.</p>${scheduleLine ? `<p style="margin:8px 0;color:#334155"><strong>Meeting:</strong> ${escapeHtml(group.meetingSchedule)}</p>` : ''}${locationLine ? `<p style="margin:8px 0;color:#334155"><strong>Location:</strong> ${escapeHtml(group.locationText)}</p>` : ''}<a href="${escapeHtml(absoluteLink)}" style="display:inline-block;margin-top:14px;padding:12px 18px;border-radius:9px;background:#106eb6;color:#fff;text-decoration:none;font-weight:700">View group</a>${telegramLink ? `<p style="margin:18px 0 8px;color:#64748b;font-size:14px">Following here does not automatically join the external Telegram group.</p><a href="${escapeHtml(telegramLink)}" style="color:#106eb6;font-weight:700">Join the Telegram group</a>` : ''}</div></div></div>`,
      })
    );
  } else {
    await recordDelivery(userId, group, groupType, 'email', 'SKIPPED');
  }

  const telegramOn = preferences.telegramEnabled && Boolean(user.telegram_chat_id);
  if (telegramOn) {
    const language = String(user.telegramLanguage || 'en').toLowerCase().split('-')[0];
    const text = (key, values) => telegramText(language, key, values);
    const localizedDetails = [
      group.meetingSchedule ? text('groupFollowMeeting', { value: group.meetingSchedule }) : '',
      group.locationText ? text('groupFollowLocation', { value: group.locationText }) : '',
    ].filter(Boolean);
    await deliver(userId, group, groupType, 'telegram', async () =>
      sendTelegramNotification({
        chatId: user.telegram_chat_id,
        text: [
          text('groupFollowWelcome', { group: group.name }),
          text('groupFollowUpdates'),
          ...localizedDetails,
          telegramLink ? text('groupFollowExternalNote') : '',
        ].filter(Boolean).join('\n\n'),
        buttons: [
          { text: text('groupFollowView'), url: absoluteLink },
          ...(telegramLink ? [{ text: text('groupFollowJoin'), url: telegramLink }] : []),
        ],
      })
    );
  } else {
    await recordDelivery(userId, group, groupType, 'telegram', 'SKIPPED');
  }
}

async function deliver(userId, group, groupType, channel, send) {
  await recordDelivery(userId, group, groupType, channel, 'PENDING');
  try {
    await send();
    await updateDelivery(userId, group, groupType, channel, 'SENT');
  } catch (error) {
    await updateDelivery(userId, group, groupType, channel, 'FAILED', error.message);
    console.error(`[group follow] ${channel} welcome failed:`, error.message);
  }
}

async function recordDelivery(userId, group, groupType, channel, status) {
  await pool.query(
    `INSERT INTO group_notification_deliveries(post_id,user_id,group_id,group_type,notification_type,channel,status,sent_at)
     VALUES(NULL,$1,$2,$3,'GROUP_FOLLOW_WELCOME',$4,$5,CASE WHEN $5='SENT' THEN NOW() ELSE NULL END)
     ON CONFLICT (user_id,group_id,group_type,channel) WHERE notification_type='GROUP_FOLLOW_WELCOME'
     DO UPDATE SET status=EXCLUDED.status,sent_at=EXCLUDED.sent_at,error_message=NULL`,
    [userId, group.id, groupType, channel, status]
  );
}

async function updateDelivery(userId, group, groupType, channel, status, errorMessage = null) {
  await pool.query(
    `UPDATE group_notification_deliveries SET status=$5,sent_at=CASE WHEN $5='SENT' THEN NOW() ELSE NULL END,error_message=$6
     WHERE user_id=$1 AND group_id=$2 AND group_type=$3 AND channel=$4 AND notification_type='GROUP_FOLLOW_WELCOME'`,
    [userId, group.id, groupType, channel, status, errorMessage?.slice(0, 1000) ?? null]
  );
}