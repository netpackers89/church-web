import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { createNewChristianWelcomeEmail } from '../services/welcomeEmailTemplate.js';
import { sendEmailNotification } from '../services/emailService.js';
import { sendTelegramNotification } from '../services/telegramService.js';
import { sendMemberWelcomeEmail, sendMemberWelcomeTelegram } from '../services/memberWelcomeService.js';
import { clientIp } from '../services/auditService.js';
import { pageParams, paged, requestError } from '../utils/http.js';

const FOLLOWUP_STATUSES = new Set([
  'NEWCOMER', 'NEW_BELIEVER', 'FOLLOW_UP', 'TEACHING',
  'BAPTISM_PREPARATION', 'BAPTIZED', 'ACTIVE_MEMBER',
  'RETURNING', 'INACTIVE', 'CONTINUING_MEMBER',
]);

const STATUS_TRANSITIONS = {
  NEWCOMER: ['NEW_BELIEVER', 'FOLLOW_UP', 'INACTIVE'],
  NEW_BELIEVER: ['FOLLOW_UP', 'INACTIVE'],
  FOLLOW_UP: ['NEW_BELIEVER', 'TEACHING', 'INACTIVE'],
  TEACHING: ['BAPTISM_PREPARATION', 'ACTIVE_MEMBER', 'INACTIVE'],
  BAPTISM_PREPARATION: ['BAPTIZED', 'INACTIVE'],
  BAPTIZED: ['ACTIVE_MEMBER', 'INACTIVE'],
  ACTIVE_MEMBER: ['CONTINUING_MEMBER', 'INACTIVE'],
  CONTINUING_MEMBER: ['ACTIVE_MEMBER', 'INACTIVE'],
  INACTIVE: ['RETURNING', 'ACTIVE_MEMBER'],
  RETURNING: ['FOLLOW_UP', 'ACTIVE_MEMBER', 'INACTIVE'],
};

const FOLLOWUP_SELECT = `
  f.id, f.full_name AS "fullName", f.phone, f.email, f.location,
  f.preferred_contact_method AS "preferredContactMethod",
  f.preferred_language AS "preferredLanguage", f.accepted_jesus AS "acceptedJesus",
  f.consent_to_contact AS "consentToContact", f.prayer_request AS "prayerRequest",
  f.status, f.assigned_to_user_id AS "assignedToUserId", a.name AS "assignedToName",
  f.linked_user_id AS "linkedUserId", m.name AS "linkedUserName", f.telegram_chat_id IS NOT NULL AS "telegramConnected",
  f.email_delivery_status AS "emailDeliveryStatus", f.email_delivery_error AS "emailDeliveryError",
  f.telegram_delivery_status AS "telegramDeliveryStatus", f.telegram_delivery_error AS "telegramDeliveryError",
  f.telegram_connected_at AS "telegramConnectedAt", f.created_at AS "createdAt", f.updated_at AS "updatedAt"`;

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function positiveId(value, label = 'Record') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw fail(`${label} was not found.`, 404);
  return id;
}

function capabilityHash(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(value)) throw fail('This follow-up link is invalid or expired.', 403);
  return createHash('sha256').update(value).digest('hex');
}

function sameHash(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.trim() === right;
}

export async function createFollowupTelegramLink(request, response) {
  try {
    const id = positiveId(request.body?.followupId, 'Follow-up record');
    const linkSecretHash = capabilityHash(request.body?.linkSecret);
    if (!config.telegram.token || !config.telegram.username) throw fail('Telegram linking is not configured. Please contact the church team.', 503);

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const record = await client.query(`SELECT id,link_secret_hash,telegram_chat_id,link_secret_expires_at>NOW() AS capability_valid FROM new_christian_followups WHERE id=$1 FOR UPDATE`, [id]);
      if (!record.rowCount || !record.rows[0].capability_valid || !sameHash(record.rows[0].link_secret_hash, linkSecretHash)) throw fail('This follow-up link is invalid or expired.', 403);
      if (record.rows[0].telegram_chat_id) throw fail('Telegram is already connected to this follow-up record.', 409);
      await client.query(`UPDATE new_christian_telegram_link_tokens SET used_at=NOW() WHERE followup_id=$1 AND used_at IS NULL`, [id]);
      await client.query(`INSERT INTO new_christian_telegram_link_tokens(followup_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '10 minutes')`, [id, tokenHash]);
      await client.query(`UPDATE new_christian_followups SET telegram_delivery_status='PENDING',telegram_delivery_error=NULL,updated_at=NOW() WHERE id=$1`, [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return response.status(201).json({
      success: true,
      url: `https://t.me/${config.telegram.username}?start=${token}`,
      expiresInSeconds: 600,
    });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function followupTelegramStatus(request, response) {
  try {
    const id = positiveId(request.body?.followupId, 'Follow-up record');
    const linkSecretHash = capabilityHash(request.body?.linkSecret);
    const result = await pool.query(`
      SELECT f.link_secret_hash, f.link_secret_expires_at>NOW() AS capability_valid, f.telegram_chat_id, f.telegram_connected_at,
        f.telegram_delivery_status, f.telegram_delivery_error,
        EXISTS (SELECT 1 FROM new_christian_telegram_link_tokens t
          WHERE t.followup_id=f.id AND t.used_at IS NULL AND t.expires_at>NOW()) AS token_active
      FROM new_christian_followups f WHERE f.id=$1
    `, [id]);
    if (!result.rowCount || !result.rows[0].capability_valid || !sameHash(result.rows[0].link_secret_hash, linkSecretHash)) throw fail('This follow-up link is invalid or expired.', 403);
    const row = result.rows[0];
    const status = row.telegram_chat_id ? 'CONNECTED' : row.token_active ? 'WAITING' : row.telegram_delivery_status === 'PENDING' ? 'EXPIRED' : 'NOT_CONNECTED';
    return response.json({ success: true, data: { status, connectedAt: row.telegram_connected_at, deliveryStatus: row.telegram_delivery_status, deliveryError: row.telegram_delivery_error } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function completeFollowupTelegramLink(token, identity) {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const telegramUserId = Number(identity.telegramUserId);
  const chatId = Number(identity.chatId);
  if (!Number.isSafeInteger(telegramUserId) || !Number.isSafeInteger(chatId)) throw fail('Invalid Telegram identity.');

  const client = await pool.connect();
  let followup;
  try {
    await client.query('BEGIN');
    const link = await client.query(`SELECT id,followup_id FROM new_christian_telegram_link_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() FOR UPDATE`, [tokenHash]);
    if (!link.rowCount) throw fail('This Telegram link is invalid, expired, or already used.', 400);
    const record = await client.query(`SELECT id,full_name,telegram_chat_id FROM new_christian_followups WHERE id=$1 FOR UPDATE`, [link.rows[0].followup_id]);
    if (!record.rowCount) throw fail('Follow-up record no longer exists.', 404);
    if (record.rows[0].telegram_chat_id) throw fail('Telegram is already connected to this follow-up record.', 409);

    const account = await client.query(`
      INSERT INTO telegram_accounts(telegram_user_id,chat_id,username,display_name)
      VALUES($1,$2,$3,$4)
      ON CONFLICT(telegram_user_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,username=EXCLUDED.username,
        display_name=EXCLUDED.display_name,updated_at=NOW()
      WHERE telegram_accounts.user_id IS NULL AND telegram_accounts.followup_id IS NULL
      RETURNING id
    `, [telegramUserId, String(chatId), identity.username?.slice(0, 64) || null, identity.displayName?.slice(0, 160) || null]);
    if (!account.rowCount) throw fail('This Telegram account is already connected to another church record.', 409);

    await client.query(`UPDATE telegram_accounts SET followup_id=$2,linked_at=NOW(),updated_at=NOW() WHERE id=$1`, [account.rows[0].id, record.rows[0].id]);
    const updated = await client.query(`UPDATE new_christian_followups SET telegram_chat_id=$2,telegram_connected_at=NOW(),telegram_delivery_status='PENDING',telegram_delivery_error=NULL,updated_at=NOW() WHERE id=$1 AND telegram_chat_id IS NULL RETURNING id,full_name AS "fullName"`, [record.rows[0].id, String(chatId)]);
    if (!updated.rowCount) throw fail('Telegram is already connected to this follow-up record.', 409);
    await client.query(`UPDATE new_christian_telegram_link_tokens SET used_at=NOW() WHERE id=$1`, [link.rows[0].id]);
    await client.query('COMMIT');
    followup = updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  try {
    await sendTelegramNotification({ chatId: String(chatId), text: `Welcome to ${config.branding.churchName}, ${followup.fullName}. We are glad to walk with you through prayer, fellowship, and spiritual guidance.` });
    await pool.query(`UPDATE new_christian_followups SET telegram_delivery_status='DELIVERED',telegram_delivery_error=NULL WHERE id=$1`, [followup.id]);
    return { kind: 'followup', id: followup.id, welcomeStatus: 'DELIVERED' };
  } catch (error) {
    await pool.query(`UPDATE new_christian_followups SET telegram_delivery_status='FAILED',telegram_delivery_error=$2 WHERE id=$1`, [followup.id, String(error.message || 'Telegram message could not be delivered.').slice(0, 1000)]);
    console.error('[new-christian] welcome Telegram failed:', error.message);
    return { kind: 'followup', id: followup.id, welcomeStatus: 'FAILED' };
  }
}

export async function listNewChristianFollowups(request, response) {
  try {
    const { page, limit, offset } = pageParams(request.query);
    const status = typeof request.query.status === 'string' && FOLLOWUP_STATUSES.has(request.query.status.toUpperCase()) ? request.query.status.toUpperCase() : null;
    const values = status ? [status, limit, offset] : [limit, offset];
    const statusFilter = status ? 'AND f.status=$1' : '';
    const limitPosition = status ? 2 : 1;
    const offsetPosition = status ? 3 : 2;
    const [items, count] = await Promise.all([
      pool.query(`SELECT ${FOLLOWUP_SELECT} FROM new_christian_followups f LEFT JOIN users a ON a.id=f.assigned_to_user_id LEFT JOIN users m ON m.id=f.linked_user_id WHERE TRUE ${statusFilter} ORDER BY f.created_at DESC LIMIT $${limitPosition} OFFSET $${offsetPosition}`, values),
      pool.query(`SELECT count(*)::int AS total FROM new_christian_followups f WHERE TRUE ${statusFilter}`, status ? [status] : []),
    ]);
    return paged(response, items.rows, { page, limit }, count.rows[0].total);
  } catch (error) {
    return requestError(error, response);
  }
}

function normalizedLinkPhone(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  let cleaned = raw.replace(/[\s()-]/g, '');
  if (/^0[79]\d{8}$/.test(cleaned)) cleaned = `+251${cleaned.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) throw fail('Enter the person’s verified phone number in international format.');
  return cleaned;
}

export async function findFollowupLinkCandidates(request, response) {
  try {
    const id = positiveId(request.params.id, 'Follow-up record');
    const email = typeof request.query.email === 'string' ? request.query.email.trim().toLowerCase() : '';
    const phone = typeof request.query.phone === 'string' && request.query.phone.trim() ? normalizedLinkPhone(request.query.phone) : '';
    if (Boolean(email) === Boolean(phone)) throw fail('Search by one verified email address or phone number.');
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)) throw fail('Enter a valid email address.');
    const record = await pool.query(`SELECT id,linked_user_id AS "linkedUserId",email,phone FROM new_christian_followups WHERE id=$1`, [id]);
    if (!record.rowCount) throw fail('Follow-up record was not found.', 404);
    if (record.rows[0].linkedUserId) throw fail('This follow-up record is already linked to a member account.', 409);

    const result = email
      ? await pool.query(`SELECT id,name,email,phone FROM users WHERE LOWER(email)=LOWER($1) AND email_verified=TRUE AND account_status='ACTIVE' ORDER BY id LIMIT 10`, [email])
      : await pool.query(`SELECT id,name,email,phone FROM users WHERE regexp_replace(phone,'\\D','','g')=regexp_replace($1,'\\D','','g') AND phone_verified=TRUE AND account_status='ACTIVE' ORDER BY id LIMIT 10`, [phone]);
    const candidates = result.rows.filter((user) => email
      ? String(record.rows[0].email ?? '').toLowerCase() === String(user.email ?? '').toLowerCase()
      : normalizedLinkPhone(record.rows[0].phone) === normalizedLinkPhone(user.phone));
    return response.json({ success: true, data: candidates });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function linkFollowupToVerifiedMember(request, response) {
  const followupId = positiveId(request.params.id, 'Follow-up record');
  const userId = positiveId(request.body?.userId, 'Member account');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const followup = await client.query(`SELECT id,email,phone,linked_user_id AS "linkedUserId" FROM new_christian_followups WHERE id=$1 FOR UPDATE`, [followupId]);
    if (!followup.rowCount) throw fail('Follow-up record was not found.', 404);
    if (followup.rows[0].linkedUserId) throw fail('This follow-up record is already linked to a member account.', 409);
    const member = await client.query(`SELECT id,name,email,phone,email_verified,phone_verified FROM users WHERE id=$1 AND account_status='ACTIVE' FOR UPDATE`, [userId]);
    if (!member.rowCount) throw fail('Active member account was not found.', 404);
    const emailMatch = Boolean(member.rows[0].email_verified && followup.rows[0].email && member.rows[0].email
      && followup.rows[0].email.toLowerCase() === member.rows[0].email.toLowerCase());
    const phoneMatch = Boolean(member.rows[0].phone_verified && followup.rows[0].phone && member.rows[0].phone
      && normalizedLinkPhone(followup.rows[0].phone) === normalizedLinkPhone(member.rows[0].phone));
    if (!emailMatch && !phoneMatch) throw fail('Linking requires an exact verified email or phone match. Names and unverified contact details are not sufficient.', 409);

    const before = { linkedUserId: null };
    const updated = await client.query(`UPDATE new_christian_followups SET linked_user_id=$2,updated_by=$3,updated_at=NOW() WHERE id=$1 AND linked_user_id IS NULL RETURNING id,linked_user_id AS "linkedUserId"`, [followupId, userId, request.user.id]);
    if (!updated.rowCount) throw fail('This follow-up record has already been linked.', 409);
    const after = { ...updated.rows[0], linkedUserName: member.rows[0].name };
    await client.query(`INSERT INTO new_christian_followup_history(followup_id,actor_user_id,action,before_data,after_data) VALUES($1,$2,'MEMBER_LINKED',$3::jsonb,$4::jsonb)`, [followupId, request.user.id, JSON.stringify(before), JSON.stringify(after)]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,ip_address) VALUES($1,'NEW_CHRISTIAN_MEMBER_LINKED','new_christian_followup',$2,$3::jsonb,$4::jsonb,$5)`, [request.user.id, String(followupId), JSON.stringify(before), JSON.stringify(after), clientIp(request)]);
    await client.query('COMMIT');
    return response.json({ success: true, data: after, message: 'The follow-up record was linked using a verified identifier. The records remain distinct.' });
  } catch (error) {
    await client.query('ROLLBACK');
    return requestError(error, response);
  } finally {
    client.release();
  }
}

export async function listFollowupAssignees(_request, response) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT u.id,u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id=u.id
      JOIN role_permissions rp ON rp.role_id=ur.role_id
      JOIN permissions p ON p.id=rp.permission_id
      WHERE u.account_status='ACTIVE' AND p.code IN ('membership.manage','prayer_requests.respond')
      ORDER BY u.name
    `);
    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function updateNewChristianFollowup(request, response) {
  const id = positiveId(request.params.id, 'Follow-up record');
  const body = request.body ?? {};
  const hasStatus = body.status !== undefined;
  const hasAssignment = body.assignedToUserId !== undefined;
  const hasFaithResponse = body.acceptedJesus !== undefined;
  if (!hasStatus && !hasAssignment && !hasFaithResponse) return response.status(400).json({ error: 'Provide a status, assignedToUserId, or acceptedJesus update.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`SELECT id,status,accepted_jesus AS "acceptedJesus",assigned_to_user_id AS "assignedToUserId" FROM new_christian_followups WHERE id=$1 FOR UPDATE`, [id]);
    if (!current.rowCount) {
      await client.query('ROLLBACK');
      return response.status(404).json({ error: 'Follow-up record was not found.' });
    }
    const before = current.rows[0];
    let nextStatus = before.status;
    let assignedToUserId = before.assignedToUserId;
    let acceptedJesus = before.acceptedJesus;

    if (hasFaithResponse) {
      if (typeof body.acceptedJesus !== 'boolean') throw fail('acceptedJesus must be true or false.');
      acceptedJesus = body.acceptedJesus;
      if (!acceptedJesus && ['NEW_BELIEVER', 'TEACHING', 'BAPTISM_PREPARATION', 'BAPTIZED', 'ACTIVE_MEMBER', 'CONTINUING_MEMBER'].includes(before.status)) {
        throw fail('The acceptance record cannot be cleared after the pastoral journey has progressed.');
      }
    }

    if (hasStatus) {
      nextStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';
      if (!FOLLOWUP_STATUSES.has(nextStatus)) throw fail('Select a valid follow-up status.');
      if (nextStatus !== before.status && !(STATUS_TRANSITIONS[before.status] ?? []).includes(nextStatus)) throw fail(`The status cannot move from ${before.status} to ${nextStatus}.`);
      if (!acceptedJesus && ['NEW_BELIEVER', 'TEACHING', 'BAPTISM_PREPARATION', 'BAPTIZED', 'ACTIVE_MEMBER', 'CONTINUING_MEMBER'].includes(nextStatus)) {
        throw fail('A person who selected “Not yet” cannot be moved to a new-believer or later faith-journey status until their response is updated through an authorized pastoral conversation.');
      }
    }

    if (hasAssignment) {
      if (body.assignedToUserId === null || body.assignedToUserId === '') {
        assignedToUserId = null;
      } else {
        assignedToUserId = positiveId(body.assignedToUserId, 'Assigned staff account');
        const eligible = await client.query(`
          SELECT 1 FROM users u
          JOIN user_roles ur ON ur.user_id=u.id
          JOIN role_permissions rp ON rp.role_id=ur.role_id
          JOIN permissions p ON p.id=rp.permission_id
          WHERE u.id=$1 AND u.account_status='ACTIVE'
            AND p.code IN ('membership.manage','prayer_requests.respond') LIMIT 1
        `, [assignedToUserId]);
        if (!eligible.rowCount) throw fail('Choose an active pastor or authorized follow-up team member.');
      }
    }

    const updated = await client.query(`UPDATE new_christian_followups SET status=$2,assigned_to_user_id=$3,accepted_jesus=$4,updated_by=$5,updated_at=NOW() WHERE id=$1 RETURNING id,status,assigned_to_user_id AS "assignedToUserId",accepted_jesus AS "acceptedJesus",updated_at AS "updatedAt"`, [id, nextStatus, assignedToUserId, acceptedJesus, request.user.id]);
    const after = updated.rows[0];
    const action = hasFaithResponse && acceptedJesus !== before.acceptedJesus ? 'FAITH_RESPONSE_UPDATED' : hasStatus && nextStatus !== before.status ? 'STATUS_CHANGED' : 'ASSIGNED';
    await client.query(`INSERT INTO new_christian_followup_history(followup_id,actor_user_id,action,before_data,after_data) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`, [id, request.user.id, action, JSON.stringify(before), JSON.stringify(after)]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,ip_address) VALUES($1,$2,'new_christian_followup',$3,$4::jsonb,$5::jsonb,$6)`, [request.user.id, `NEW_CHRISTIAN_${action}`, String(id), JSON.stringify(before), JSON.stringify(after), clientIp(request)]);
    await client.query('COMMIT');
    return response.json({ success: true, data: after });
  } catch (error) {
    await client.query('ROLLBACK');
    return requestError(error, response);
  } finally {
    client.release();
  }
}

export async function retryNewChristianWelcome(request, response) {
  const id = positiveId(request.params.id, 'Follow-up record');
  const channel = typeof request.body?.channel === 'string' ? request.body.channel.toLowerCase() : '';
  if (!['email', 'telegram'].includes(channel)) return response.status(400).json({ error: 'Select email or telegram as the delivery channel.' });

  const client = await pool.connect();
  let recipient;
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT id,full_name AS "fullName",email,telegram_chat_id AS "telegramChatId",email_delivery_status AS "emailStatus",telegram_delivery_status AS "telegramStatus" FROM new_christian_followups WHERE id=$1 FOR UPDATE`, [id]);
    if (!result.rowCount) throw fail('Follow-up record was not found.', 404);
    recipient = result.rows[0];
    if (channel === 'email' && (!recipient.email || recipient.emailStatus !== 'FAILED')) throw fail('Email can only be retried when a provided email address has a failed delivery.', 409);
    if (channel === 'telegram' && (!recipient.telegramChatId || recipient.telegramStatus !== 'FAILED')) throw fail('Telegram can only be retried when connected and the previous delivery failed.', 409);
    const statusColumn = channel === 'email' ? 'email_delivery_status' : 'telegram_delivery_status';
    await client.query(`UPDATE new_christian_followups SET ${statusColumn}='PENDING',updated_at=NOW() WHERE id=$1`, [id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    return requestError(error, response);
  }
  client.release();

  try {
    if (channel === 'email') {
      const welcome = createNewChristianWelcomeEmail(recipient.fullName);
      await sendEmailNotification({ to: recipient.email, ...welcome });
      await pool.query(`UPDATE new_christian_followups SET email_delivery_status='DELIVERED',email_delivery_error=NULL,updated_at=NOW() WHERE id=$1`, [id]);
    } else {
      await sendTelegramNotification({ chatId: recipient.telegramChatId, text: `Welcome to ${config.branding.churchName}, ${recipient.fullName}. We are glad to walk with you through prayer, fellowship, and spiritual guidance.` });
      await pool.query(`UPDATE new_christian_followups SET telegram_delivery_status='DELIVERED',telegram_delivery_error=NULL,updated_at=NOW() WHERE id=$1`, [id]);
    }
    return response.json({ success: true, data: { channel, status: 'DELIVERED' } });
  } catch (error) {
    const message = String(error.message || `${channel} delivery failed.`).slice(0, 1000);
    const statusColumn = channel === 'email' ? 'email_delivery_status' : 'telegram_delivery_status';
    const errorColumn = channel === 'email' ? 'email_delivery_error' : 'telegram_delivery_error';
    await pool.query(`UPDATE new_christian_followups SET ${statusColumn}='FAILED',${errorColumn}=$2,updated_at=NOW() WHERE id=$1`, [id, message]);
    return response.status(502).json({ error: `${channel} delivery failed. The record was kept and can be retried safely.` });
  }
}

export async function retryMemberWelcome(request, response) {
  try {
    const userId = positiveId(request.params.userId, 'Member account');
    const channel = typeof request.body?.channel === 'string' ? request.body.channel.toLowerCase() : '';
    if (!['email', 'telegram'].includes(channel)) throw fail('Select email or telegram as the delivery channel.');
    const result = await pool.query(`
      SELECT u.id,u.name,u.email,u.telegram_chat_id AS "telegramChatId",d.status
      FROM users u JOIN member_welcome_deliveries d ON d.user_id=u.id AND d.channel=$2
      WHERE u.id=$1 AND u.account_status='ACTIVE'
    `, [userId, channel.toUpperCase()]);
    if (!result.rowCount) throw fail('No recorded welcome delivery exists for that member and channel.', 404);
    const record = result.rows[0];
    if (record.status !== 'FAILED') throw fail('Only a failed welcome delivery can be retried.', 409);
    if (channel === 'email' && !record.email) throw fail('This member has no email address.', 409);
    if (channel === 'telegram' && !record.telegramChatId) throw fail('This member has no connected Telegram chat.', 409);

    const delivery = channel === 'email'
      ? await sendMemberWelcomeEmail(record)
      : await sendMemberWelcomeTelegram(userId, record.telegramChatId);
    if (delivery.status === 'FAILED') return response.status(502).json({ error: delivery.error || `The ${channel} welcome could not be delivered.` });
    return response.json({ success: true, data: { channel, status: delivery.status } });
  } catch (error) {
    return requestError(error, response);
  }
}
