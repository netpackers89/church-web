import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { sendEmailNotification } from './emailService.js';
import { sendTelegramNotification } from './telegramService.js';
import { createWelcomeEmail } from './welcomeEmailTemplate.js';
import { renderEmailHtml, renderTemplateVariables } from './notificationStudioService.js';

export async function createMemberWelcomeNotification(user) {
  const firstName = user.name.trim().split(/\s+/)[0] || 'there';
  const result = await pool.query(`INSERT INTO user_notifications
    (user_id,event_id,type,title,body,link_url,email_status)
    VALUES($1,NULL,'MEMBER_WELCOME',$2,$3,'/me','SKIPPED')
    ON CONFLICT (user_id,type) WHERE event_id IS NULL AND type='MEMBER_WELCOME'
    DO NOTHING RETURNING id`, [
    user.id,
    `Welcome, ${firstName}!`,
    `We are happy to welcome you to our church community. Your account is ready, and you can now explore church activities, announcements, departments, events, and member services. We look forward to growing together in faith and fellowship.`,
  ]);
  return { status: result.rowCount ? 'created' : 'already_exists' };
}

async function reserveDelivery(userId, channel) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(`INSERT INTO member_welcome_deliveries(user_id,channel,status) VALUES($1,$2,'PENDING') ON CONFLICT(user_id,channel) DO NOTHING RETURNING id`, [userId, channel]);
    if (inserted.rowCount) {
      await client.query('COMMIT');
      return { reserved: true, status: 'PENDING' };
    }
    const current = await client.query(`SELECT status FROM member_welcome_deliveries WHERE user_id=$1 AND channel=$2 FOR UPDATE`, [userId, channel]);
    if (current.rows[0]?.status === 'DELIVERED' || current.rows[0]?.status === 'PENDING') {
      await client.query('COMMIT');
      return { reserved: false, status: current.rows[0].status };
    }
    await client.query(`UPDATE member_welcome_deliveries SET status='PENDING',error_detail=NULL,updated_at=NOW() WHERE user_id=$1 AND channel=$2`, [userId, channel]);
    await client.query('COMMIT');
    return { reserved: true, status: 'PENDING' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function setDeliveryStatus(userId, channel, status, error = null) {
  await pool.query(`UPDATE member_welcome_deliveries SET status=$3::VARCHAR(16),error_detail=$4,delivered_at=CASE WHEN $3::VARCHAR(16)='DELIVERED' THEN NOW() ELSE delivered_at END,updated_at=NOW() WHERE user_id=$1 AND channel=$2`, [userId, channel, status, error ? String(error).slice(0, 1000) : null]);
}

export async function sendMemberWelcomeEmail(user) {
  const reservation = await reserveDelivery(user.id, 'EMAIL');
  if (!reservation.reserved) return { status: reservation.status };
  try {
    const welcome = await loadWelcomeEmailTemplate(user);
    const details = await sendEmailNotification({ to: user.email, ...welcome });
    await setDeliveryStatus(user.id, 'EMAIL', 'DELIVERED');
    return { status: 'DELIVERED', details };
  } catch (error) {
    await setDeliveryStatus(user.id, 'EMAIL', 'FAILED', error.message);
    console.error('[auth] welcome email failed:', error.message);
    return { status: 'FAILED', error: 'Registration succeeded, but the welcome email could not be delivered.' };
  }
}

export async function loadWelcomeEmailTemplate(user) {
  const result = await pool.query(`SELECT subject_template AS "subjectTemplate",body_template AS "bodyTemplate",
    title,greeting,signature,banner_url AS "bannerUrl",cta_url AS "ctaUrl",cta_label AS "ctaLabel"
    FROM notification_templates WHERE code='email_welcome_default' AND channel='EMAIL' AND is_archived=FALSE LIMIT 1`);
  if (!result.rowCount) return createWelcomeEmail(user.name);
  const template = result.rows[0];
  const firstName = String(user.name ?? '').trim().split(/\s+/)[0] || 'friend';
  const variables = { name: user.name ?? '', firstName, churchName: config.branding.churchName, email: user.email ?? '' };
  const render = (value) => renderTemplateVariables(value ?? '', variables);
  const subject = render(template.subjectTemplate) || `Welcome to ${config.branding.churchName}`;
  const title = render(template.title) || subject;
  const greeting = render(template.greeting);
  const body = render(template.bodyTemplate);
  const signature = render(template.signature);
  const ctaUrl = render(template.ctaUrl);
  const ctaLabel = render(template.ctaLabel);
  const text = [greeting, title, body, signature, ctaUrl].filter(Boolean).join('\n\n');
  const html = renderEmailHtml({
    greeting,
    subject: title,
    body: [body, signature].filter(Boolean).join('\n\n'),
    bannerUrl: render(template.bannerUrl),
    ctaUrl,
    ctaLabel,
  });
  return { subject, text, html };
}

export async function sendMemberWelcomeTelegram(userId, chatId) {
  const reservation = await reserveDelivery(userId, 'TELEGRAM');
  if (!reservation.reserved) return { status: reservation.status };
  try {
    const person = await pool.query('SELECT name FROM users WHERE id=$1', [userId]);
    if (!person.rowCount) throw new Error('Member account was not found for the Telegram welcome.');
    await sendTelegramNotification({
      chatId,
      text: `Welcome to ${config.branding.churchName}, ${person.rows[0].name}. Your account is connected, and you can receive church updates and notifications here.`,
    });
    await setDeliveryStatus(userId, 'TELEGRAM', 'DELIVERED');
    return { status: 'DELIVERED' };
  } catch (error) {
    await setDeliveryStatus(userId, 'TELEGRAM', 'FAILED', error.message);
    console.error('[auth] welcome Telegram failed:', error.message);
    return { status: 'FAILED', error: 'The Telegram welcome could not be delivered.' };
  }
}
