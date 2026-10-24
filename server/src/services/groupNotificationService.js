import { pool } from '../config/db.js';
import { sendEmailNotification } from '../email/index.js';
import { sendTelegramNotification } from '../telegram/services/messaging.js';
import { config } from '../config/env.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function groupLink(groupType, groupId) {
  return groupType === 'department'
    ? `/community/departments/${groupId}`
    : `/community/bible-study-groups/${groupId}`;
}

function postLink(groupType, groupId, postId) {
  return `${groupLink(groupType, groupId)}#post-${postId}`;
}

function emailHtml({ churchName, groupName, groupBannerUrl, postTitle, postPreview, postUrl, churchContact, churchSocialLinks }) {
  const safePostUrl = escapeHtml(postUrl);
  const socialHtml = churchSocialLinks && churchSocialLinks.length
    ? churchSocialLinks.filter((link) => /^https:\/\//i.test(link.url || '')).map((link) => `<a href="${escapeHtml(link.url)}" style="color:#6366F1; text-decoration:none; margin-right:1rem;">${escapeHtml(link.label)}</a>`).join('')
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(postTitle)}</title></head><body style="margin:0; padding:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color:#f8fafc;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:2rem 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
        ${/^https:\/\//i.test(groupBannerUrl || '')
          ? `<tr><td><img src="${escapeHtml(groupBannerUrl)}" alt="${escapeHtml(groupName)}" width="640" height="200" style="width:100%; height:auto; display:block;" /></td></tr>`
          : '<tr><td style="height:200px; background-color:#e2e8f0;"></td></tr>'}
        <tr><td style="padding:1.5rem 2rem;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="left" style="padding-bottom:0.5rem;">
              <span style="display:inline-block; font-size:0.75rem; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; color:#6366F1;">${escapeHtml(churchName)}</span>
            </td></tr>
            <tr><td align="left" style="padding-bottom:1rem;">
              <h1 style="margin:0; font-size:1.5rem; font-weight:700; color:#0f172a; line-height:1.25;">${escapeHtml(postTitle)}</h1>
            </td></tr>
            <tr><td align="left" style="padding-bottom:1.5rem; font-size:0.95rem; color:#475569; line-height:1.6;">
              ${escapeHtml(postPreview).replace(/\n/g, '<br>')}
            </td></tr>
            <tr><td align="left">
              <a href="${safePostUrl}" style="display:inline-block; background-color:#6366F1; color:#ffffff; text-decoration:none; padding:0.75rem 1.5rem; border-radius:8px; font-weight:600; font-size:0.95rem;">Read post</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:1.5rem 2rem; border-top:1px solid #e2e8f0; background-color:#f8fafc;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="left" style="padding-bottom:1rem;">
              <p style="margin:0 0 0.5rem 0; font-size:0.8rem; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">${escapeHtml(churchName)}</p>
              <p style="margin:0; font-size:0.85rem; color:#64748b; line-height:1.5;">${escapeHtml(churchContact)}</p>
            </td></tr>
            ${socialHtml ? `<tr><td align="left" style="padding-top:1rem;">${socialHtml}</td></tr>` : ''}
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
export async function queueGroupPostNotifications({ post, group, followersWithPrefs, churchName, churchContact, churchSocialLinks }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];
    const postUrl = new URL(postLink(group.group_type, group.id, post.id), config.webOrigin).href;

    for (const { user_id, email, telegram_chat_id, notify_email, notify_telegram, email_enabled, telegram_enabled, in_app_enabled } of followersWithPrefs) {
      const preview = post.body ? post.body.slice(0, 160) + (post.body.length > 160 ? '\u2026' : '') : '';

      if (in_app_enabled !== false) {
        await client.query(
          `INSERT INTO group_notification_deliveries(post_id, user_id, channel, status, sent_at)
           VALUES ($1, $2, 'in_app', 'SENT', NOW())`,
          [post.id, user_id]
        );
        await client.query(
          `INSERT INTO user_notifications(user_id, type, title, body, link_url, notification_status, email_status)
           VALUES ($1, 'GROUP_POST', $2, $3, $4, 'PENDING', 'SKIPPED')`,
          [user_id, `${group.name} published a new post.`, post.title, postLink(group.group_type, group.id, post.id)]
        );
        inserted.push({ user_id, channel: 'in_app', status: 'SENT' });
      }

      if ((email_enabled ?? notify_email) !== false && notify_email !== false && email) {
        await client.query(
          `INSERT INTO group_notification_deliveries(post_id, user_id, channel, status)
           VALUES ($1, $2, 'email', 'PENDING')`,
          [post.id, user_id]
        );
        inserted.push({ user_id, channel: 'email', status: 'PENDING' });
        try {
          const html = emailHtml({
            churchName, groupName: group.name,
            groupBannerUrl: group.banner_url || group.banner_image || null,
            postTitle: post.title, postPreview: preview, postUrl,
            churchContact, churchSocialLinks,
          });
          await sendEmailNotification({
            to: email,
            subject: `${churchName}: ${post.title}`,
            text: `${post.title}\n\n${preview}\n\nRead post: ${postUrl}`,
            html,
          });
          await client.query(
            `UPDATE group_notification_deliveries SET status='SENT', sent_at=NOW() WHERE post_id=$1 AND user_id=$2 AND channel='email'`,
            [post.id, user_id]
          );
        } catch (error) {
          await client.query(
            `UPDATE group_notification_deliveries SET status='FAILED', error_message=$3 WHERE post_id=$1 AND user_id=$2 AND channel='email'`,
            [post.id, user_id, error.message.slice(0, 1000)]
          );
          console.error('[group notifications] email failed:', error.message);
        }
      }

      if ((telegram_enabled ?? notify_telegram) !== false && notify_telegram !== false && telegram_chat_id) {
        await client.query(
          `INSERT INTO group_notification_deliveries(post_id, user_id, channel, status)
           VALUES ($1, $2, 'telegram', 'PENDING')`,
          [post.id, user_id]
        );
        inserted.push({ user_id, channel: 'telegram', status: 'PENDING' });
        try {
          const message = `<b>${escapeHtml(group.name)}</b>\n\n<b>${escapeHtml(post.title)}</b>\n\n${escapeHtml(preview)}\n\n<a href="${escapeHtml(postUrl)}">Read post</a>`;
          await sendTelegramNotification({
            chatId: telegram_chat_id, text: message,
            buttons: [{ text: 'Read post', url: postUrl }],
            parseMode: 'HTML',
          });
          await client.query(
            `UPDATE group_notification_deliveries SET status='SENT', sent_at=NOW() WHERE post_id=$1 AND user_id=$2 AND channel='telegram'`,
            [post.id, user_id]
          );
        } catch (error) {
          await client.query(
            `UPDATE group_notification_deliveries SET status='FAILED', error_message=$3 WHERE post_id=$1 AND user_id=$2 AND channel='telegram'`,
            [post.id, user_id, error.message.slice(0, 1000)]
          );
          console.error('[group notifications] telegram failed:', error.message);
        }
      }
    }

    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
