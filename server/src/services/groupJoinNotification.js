import { pool } from '../config/db.js';
import { sendEmailNotification } from '../email/index.js';
import { sendTelegramNotification } from '../telegram/services/messaging.js';
import { config } from '../config/env.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function safeTelegramUrl(value) {
  const url = safeUrl(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return ['t.me', 'telegram.me'].includes(parsed.hostname.toLowerCase()) ? parsed.href : null;
  } catch { return null; }
}

export function createGroupJoinEmail({ churchName, recipientName, groupName, groupDescription, groupBannerUrl, groupLogoUrl, groupTypeLabel, telegramLink, meetingSchedule, locationText, churchContact, churchWebsite, churchSocialLinks }) {
  const telegramUrl = safeTelegramUrl(telegramLink);
  const websiteUrl = safeUrl(churchWebsite);
  const scheduleHtml = meetingSchedule ? `<p style="margin:8px 0;font-size:0.9rem;color:#334155;"><strong>Meeting:</strong> ${escapeHtml(meetingSchedule)}</p>` : '';
  const locationHtml = locationText ? `<p style="margin:8px 0;font-size:0.9rem;color:#334155;"><strong>Location:</strong> ${escapeHtml(locationText)}</p>` : '';

  const socialHtml = (churchSocialLinks ?? []).filter(Boolean).map((link) => {
    const href = safeUrl(link.url);
    if (!href) return '';
    return `<a href="${escapeHtml(href)}" style="color:${link.color ?? '#6366F1'}; text-decoration:none; margin-right:12px; font-size:14px;">${escapeHtml(link.label)}</a>`;
  }).join('');

  const ctaButton = telegramUrl
    ? `<a href="${escapeHtml(telegramUrl)}" style="display:inline-block;margin-top:14px;padding:12px 24px;border-radius:8px;background:#6366F1;color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:600;text-decoration:none;">Open in Telegram</a>`
    : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Joined ${escapeHtml(groupName)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
${groupBannerUrl
  ? `<tr><td><img src="${escapeHtml(groupBannerUrl)}" alt="${escapeHtml(groupName)}" width="620" height="200" style="width:100%;height:auto;display:block;" /></td></tr>`
  : '<tr><td style="height:200px;background:#e2e8f0;"></td></tr>'}
<tr><td style="padding:24px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="left" style="padding-bottom:12px;">
<span style="display:inline-block;font-size:0.75rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#6366F1;">${escapeHtml(churchName)}</span>
</td></tr>
<tr><td align="left" style="padding-bottom:8px;">
<h1 style="margin:0;font-size:1.5rem;font-weight:700;color:#0f172a;line-height:1.25;">You joined ${escapeHtml(groupName)}</h1>
</td></tr>
<tr><td align="left" style="padding-bottom:16px;">
<p style="margin:0;font-size:0.95rem;color:#475569;line-height:1.6;">You're now a member of ${escapeHtml(groupName)} — ${escapeHtml(groupTypeLabel)}. ${escapeHtml(groupDescription ?? 'A community of believers serving together.')}</p>
</td></tr>
${scheduleHtml || locationHtml ? `<tr><td align="left" style="padding-bottom:16px;">${scheduleHtml}${locationHtml}</td></tr>` : ''}
<tr><td align="left" style="padding-bottom:16px;">
${ctaButton}
</td></tr>
${telegramUrl ? `<tr><td align="left" style="padding-bottom:16px;"><p style="margin:0;font-size:0.88rem;color:#64748b;">Connect with this group on Telegram: <a href="${escapeHtml(telegramUrl)}" style="color:#6366F1;text-decoration:underline;">${escapeHtml(telegramLink)}</a></p></td></tr>` : ''}
</table>
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="left" style="padding-bottom:8px;">
<p style="margin:0 0 4px 0;font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">${escapeHtml(churchName)}</p>
<p style="margin:0;font-size:0.85rem;color:#64748b;line-height:1.5;">${escapeHtml(churchContact ?? '')}</p>
</td></tr>
${socialHtml ? `<tr><td align="left" style="padding-top:12px;">${socialHtml}</td></tr>` : ''}
</table>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    `You joined ${groupName}!`,
    ``,
    `${groupDescription ?? ''}`,
    meetingSchedule ? `Meeting: ${meetingSchedule}` : '',
    locationText ? `Location: ${locationText}` : '',
    ``,
    `Group type: ${groupTypeLabel}`,
    telegramLink ? `Telegram: ${telegramLink}` : ``,
    ``,
    churchContact ?? ``,
    churchWebsite ?? ``,
  ].filter(Boolean).join('\n');

  return { subject: `You joined ${groupName} — ${churchName}`, text, html };
}

export async function sendGroupJoinConfirmation({ user, group, groupTypeLabel, churchContact, churchWebsite, churchSocialLinks }) {
  const emailResults = [];
  let telegramResult = { status: 'SKIPPED', reason: 'Telegram not linked or notifications disabled' };
  const isDepartment = groupTypeLabel.toLowerCase().includes('department');
  const groupPath = isDepartment ? `/community/departments/${group.id}` : `/community/bible-study-groups/${group.id}`;
  const telegramLink = safeTelegramUrl(group.telegramPublicLink || group.telegram_public_link || (group.telegramUsername || group.telegram_username ? `https://t.me/${String(group.telegramUsername || group.telegram_username).replace(/^@/, '')}` : null));
  const groupDetails = [
    group.meetingSchedule || group.meeting_schedule ? `Meeting: ${group.meetingSchedule || group.meeting_schedule}` : '',
    group.locationText || group.location_text ? `Location: ${group.locationText || group.location_text}` : '',
    telegramLink ? `Join the group on Telegram: ${telegramLink}` : '',
  ].filter(Boolean).join('\n');

  // In-app notification
  try {
    await pool.query(
      `INSERT INTO user_notifications(user_id, type, title, body, link_url, notification_status, email_status)
       VALUES ($1, 'GROUP_JOIN', $2, $3, $4, 'PENDING', 'SKIPPED')`,
      [user.id, `${group.name} — You joined!`, [`You are now a member of ${group.name}.`, groupDetails].filter(Boolean).join('\n\n'), groupPath]
    );
  } catch (error) {
    console.error('[group join] in-app notification failed:', error.message);
  }

  // Email
  if (user.email && user.notify_email !== false) {
    try {
      const email = createGroupJoinEmail({
        churchName: config.branding.churchName,
        recipientName: user.name,
        groupName: group.name,
        groupDescription: group.description,
        groupBannerUrl: group.bannerUrl || group.banner_url || group.banner_image,
        groupLogoUrl: group.logoUrl || group.logo_url || group.group_profile_image,
        groupTypeLabel,
        telegramLink,
        meetingSchedule: group.meetingSchedule || group.meeting_schedule,
        locationText: group.locationText || group.location_text,
        churchContact,
        churchWebsite,
        churchSocialLinks,
      });
      const sent = await sendEmailNotification({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      emailResults.push({ channel: 'email', status: 'DELIVERED', details: sent });
    } catch (error) {
      emailResults.push({ channel: 'email', status: 'FAILED', error: error.message.slice(0, 1000) });
      console.error('[group join] email failed:', error.message);
    }
  }

  // Telegram
  if (user.telegram_chat_id && user.notify_telegram !== false) {
    try {
      const telegramUrl = safeTelegramUrl(group.telegramPublicLink || group.telegram_public_link || (group.telegramUsername || group.telegram_username ? `https://t.me/${String(group.telegramUsername || group.telegram_username).replace(/^@/, '')}` : null));
      const groupPath = groupTypeLabel.toLowerCase().includes('department') ? `/community/departments/${group.id}` : `/community/bible-study-groups/${group.id}`;
      const groupUrl = new URL(groupPath, config.webOrigin).href;
      const details = [
        group.meetingSchedule || group.meeting_schedule ? `Meeting: ${group.meetingSchedule || group.meeting_schedule}` : '',
        group.locationText || group.location_text ? `Location: ${group.locationText || group.location_text}` : '',
      ].filter(Boolean);
      const message = `✅ You joined ${group.name} (${groupTypeLabel}).\n\n${group.description ?? 'A community of believers serving together.'}${details.length ? `\n\n${details.join('\n')}` : ''}${telegramUrl ? '\n\nUse the Telegram button below to join the external group.' : ''}`;
      await sendTelegramNotification({
        chatId: user.telegram_chat_id,
        text: message,
        buttons: [
          { text: 'View group', url: groupUrl },
          ...(telegramUrl ? [{ text: 'Join Telegram group', url: telegramUrl }] : []),
        ],
      });
      telegramResult = { status: 'DELIVERED' };
    } catch (error) {
      telegramResult = { status: 'FAILED', error: error.message.slice(0, 1000) };
      console.error('[group join] telegram failed:', error.message);
    }
  }

  return { email: emailResults, telegram: telegramResult };
}
