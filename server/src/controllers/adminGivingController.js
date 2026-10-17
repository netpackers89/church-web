import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { pageParams, paged, requestError } from '../utils/http.js';
import { config } from '../config/env.js';
import { sendEmailNotification } from '../services/emailService.js';
import { sendTelegramNotification } from '../services/telegramService.js';

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

/** Build a unique, human-readable receipt number. */
function receiptNumber() {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RCPT-${timestamp}-${random}`;
}

async function notifyContributor(donationId, record, decision, note = '') {
  const channels = [
    { channel: 'EMAIL', target: record.userEmail },
    { channel: 'TELEGRAM', target: record.telegramChatId },
  ];
  const outcomes = {};
  for (const { channel, target } of channels) {
    if (!target) {
      outcomes[channel] = { status: 'SKIPPED' };
      await pool.query(`INSERT INTO donation_notification_deliveries(donation_id,channel,outcome) VALUES($1,$2,'SKIPPED') ON CONFLICT(donation_id,channel) DO UPDATE SET outcome='SKIPPED',error_detail=NULL,updated_at=NOW()`, [donationId,channel]);
      continue;
    }
    await pool.query(`INSERT INTO donation_notification_deliveries(donation_id,channel,outcome) VALUES($1,$2,'PENDING') ON CONFLICT(donation_id,channel) DO UPDATE SET outcome='PENDING',error_detail=NULL,updated_at=NOW()`, [donationId,channel]);
    try {
      const text = decision === 'APPROVED'
        ? `Your contribution of ${record.currency || 'ETB'} ${record.amount} to ${config.branding.churchName} has been approved. Your receipt number is ${record.receiptNumber}. Thank you for your generosity.`
        : `Your contribution submission to ${config.branding.churchName} was not approved. Reason: ${note}. Please contact the finance team if you need help correcting the details.`;
      if (channel === 'EMAIL') {
        await sendEmailNotification({ to: target, subject: decision === 'APPROVED' ? `${config.branding.churchName} contribution verified` : `${config.branding.churchName} contribution needs attention`, text });
      } else {
        await sendTelegramNotification({ chatId: target, text });
      }
      outcomes[channel] = { status: 'DELIVERED' };
      await pool.query(`UPDATE donation_notification_deliveries SET outcome='DELIVERED',error_detail=NULL,updated_at=NOW() WHERE donation_id=$1 AND channel=$2`, [donationId,channel]);
    } catch (error) {
      const detail = String(error.message || `${channel} delivery failed.`).slice(0,1000);
      outcomes[channel] = { status: 'FAILED', error: detail };
      await pool.query(`UPDATE donation_notification_deliveries SET outcome='FAILED',error_detail=$3,updated_at=NOW() WHERE donation_id=$1 AND channel=$2`, [donationId,channel,detail]);
      console.error(`[giving] ${channel.toLowerCase()} notification failed for donation ${donationId}:`, error.message);
    }
  }
  return outcomes;
}

/**
 * Church-wide, public configuration read from system_settings (is_public).
 * Safe to expose in a printable receipt, which is not donor-sensitive data.
 */
async function churchInfo() {
  const result = await pool.query(
    `SELECT key, value FROM system_settings WHERE key IN ('churchName', 'address', 'contactEmail', 'bank_account')`,
  );
  const map = Object.fromEntries(result.rows.map((r) => [r.key, r.value]));
  const bank = map.bank_account ? (typeof map.bank_account === 'object' ? map.bank_account : JSON.parse(map.bank_account)) : {};
  return {
    churchName: typeof map.churchName === 'string' ? map.churchName : 'Church of Ethiopia',
    address: typeof map.address === 'string' ? map.address : '',
    contactEmail: typeof map.contactEmail === 'string' ? map.contactEmail : '',
    bankName: typeof bank.bankName === 'string' ? bank.bankName : '',
    accountHolder: typeof bank.accountHolder === 'string' ? bank.accountHolder : '',
    accountNumber: typeof bank.accountNumber === 'string' ? bank.accountNumber : '',
  };
}

export async function listDonations(request, response) {
  try {
    const { page, limit, offset } = pageParams(request.query);
    const status = typeof request.query.status === 'string' && ['PENDING','APPROVED','REJECTED'].includes(request.query.status.toUpperCase()) ? request.query.status.toUpperCase() : null;
    const where = `WHERE d.deleted_at IS NULL ${status ? 'AND d.status=$1' : ''}`;
    const values = status ? [status, limit, offset] : [limit, offset];
    const limitSlot = status ? 2 : 1;
    const offsetSlot = status ? 3 : 2;
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT d.id, d.amount, d.currency, d.status, d.payment_reference AS "paymentReference",
                d.received_at AS "receivedAt", d.verified_at AS "verifiedAt", d.rejected_at AS "rejectedAt",
                d.rejection_reason AS "rejectionReason", d.reviewer_notes AS "reviewerNotes",d.recorded_by AS "recordedBy", d.created_at AS "createdAt",
                d.payment_provider AS "paymentProvider",d.payment_method_id AS "paymentMethodId",d.contributor_name AS "contributorName",d.donor_note AS note,d.receipt_url AS "receiptUrl",d.receipt_number AS "receiptNumber",
                u.name AS "userName",u.email AS "userEmail",c.name AS "categoryName", cp.title AS "campaignTitle",
                COALESCE((SELECT json_agg(json_build_object('decision',h.decision,'note',h.reviewer_note,'reviewer',r.name,'createdAt',h.created_at) ORDER BY h.created_at DESC) FROM donation_review_history h LEFT JOIN users r ON r.id=h.reviewer_user_id WHERE h.donation_id=d.id),'[]') AS "reviewHistory",
                COALESCE((SELECT json_object_agg(n.channel,json_build_object('outcome',n.outcome,'error',n.error_detail,'updatedAt',n.updated_at)) FROM donation_notification_deliveries n WHERE n.donation_id=d.id),'{}') AS "notificationOutcomes"
         FROM donations d
         LEFT JOIN users u ON u.id = d.user_id
         LEFT JOIN donation_categories c ON c.id = d.category_id
         LEFT JOIN fundraising_campaigns cp ON cp.id = d.campaign_id
         ${where}
         ORDER BY d.created_at DESC
         LIMIT $${limitSlot} OFFSET $${offsetSlot}`,
        values,
      ),
      pool.query(`SELECT count(*)::int AS total FROM donations d ${where}`, status ? [status] : []),
    ]);
    return paged(response, rows.rows, { page, limit }, count.rows[0].total);
  } catch (error) {
    return requestError(error, response);
  }
}

export async function getDonation(request, response) {
  try {
    const result = await pool.query(
      `SELECT d.*, u.name AS "userName",u.email AS "userEmail",u.telegram_chat_id AS "telegramChatId", c.name AS "categoryName", cp.title AS "campaignTitle"
       FROM donations d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN donation_categories c ON c.id = d.category_id
       LEFT JOIN fundraising_campaigns cp ON cp.id = d.campaign_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [request.params.id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Donation record not found.' });
    return response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function approveDonation(request, response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const donation = await client.query(
      `SELECT d.*, u.name AS "userName",u.email AS "userEmail",u.telegram_chat_id AS "telegramChatId", c.name AS "categoryName", cp.title AS "campaignTitle"
       FROM donations d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN donation_categories c ON c.id = d.category_id
       LEFT JOIN fundraising_campaigns cp ON cp.id = d.campaign_id
       WHERE d.id = $1 AND d.deleted_at IS NULL FOR UPDATE`,
      [request.params.id],
    );
    if (!donation.rowCount) throw Object.assign(new Error('Donation record not found.'), { status: 404 });
    const record = donation.rows[0];
    if (record.status !== 'PENDING') throw Object.assign(new Error(`This donation is already ${String(record.status).toLowerCase()}.`), { status: 409 });
    if (record.user_id === request.user.id) {
      throw Object.assign(new Error('You cannot approve your own giving submission.'), { status: 409 });
    }
    const number = record.receipt_number || receiptNumber();
    const reviewerNotes = typeof request.body?.reviewerNotes === 'string' ? request.body.reviewerNotes.trim().slice(0,2000) : null;
    await client.query(
      `UPDATE donations SET status = 'APPROVED', verified_by = $2, verified_at = NOW(),receipt_number=$3,reviewer_notes=$4
       WHERE id = $1 AND deleted_at IS NULL`,
      [request.params.id, request.user.id, number, reviewerNotes],
    );
    await client.query(`INSERT INTO donation_review_history(donation_id,reviewer_user_id,decision,reviewer_note,previous_status,next_status) VALUES($1,$2,'APPROVED',$3,$4,'APPROVED')`, [request.params.id,request.user.id,reviewerNotes,record.status]);
    await audit({
      actorUserId: request.user.id,
      action: 'GIVING_APPROVED',
      entityType: 'donation',
      entityId: request.params.id,
      before: { status: record.status, paymentReference: record.payment_reference },
      after: { status: 'APPROVED', paymentReference: record.payment_reference,receiptNumber:number,reviewerNotes },
      ipAddress: clientIp(request),
    });
    await client.query('COMMIT');
    const notificationOutcomes = await notifyContributor(record.id, { ...record, receiptNumber:number }, 'APPROVED');
    return response.json({ success: true, data: { id: record.id, status: 'APPROVED', receiptNumber:number,notificationOutcomes } });
  } catch (error) {
    await client.query('ROLLBACK');
    return requestError(error, response);
  } finally {
    client.release();
  }
}

export async function rejectDonation(request, response) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const donation = await client.query(
      `SELECT d.*, u.name AS "userName",u.email AS "userEmail",u.telegram_chat_id AS "telegramChatId", c.name AS "categoryName", cp.title AS "campaignTitle"
       FROM donations d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN donation_categories c ON c.id = d.category_id
       LEFT JOIN fundraising_campaigns cp ON cp.id = d.campaign_id
       WHERE d.id = $1 AND d.deleted_at IS NULL FOR UPDATE`,
      [request.params.id],
    );
    if (!donation.rowCount) throw Object.assign(new Error('Donation record not found.'), { status: 404 });
    const record = donation.rows[0];
    if (record.status !== 'PENDING') throw Object.assign(new Error(`This donation is already ${String(record.status).toLowerCase()}.`), { status: 409 });
    if (record.user_id === request.user.id) {
      throw Object.assign(new Error('You cannot reject your own giving submission.'), { status: 409 });
    }
    const reason = request.body?.reason;
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      throw fail('Provide a short reason for the rejection.', 400);
    }
    const rejectionReason = reason.trim().slice(0,1000);
    const reviewerNotes = typeof request.body?.reviewerNotes === 'string' ? request.body.reviewerNotes.trim().slice(0,2000) : null;
    await client.query(
      `UPDATE donations SET status = 'REJECTED', rejected_at = NOW(), rejection_reason = $2, verified_by = $3, verified_at = NOW(),reviewer_notes=$4
       WHERE id = $1 AND deleted_at IS NULL`,
      [request.params.id, rejectionReason, request.user.id,reviewerNotes],
    );
    await client.query(`INSERT INTO donation_review_history(donation_id,reviewer_user_id,decision,reviewer_note,previous_status,next_status) VALUES($1,$2,'REJECTED',$3,$4,'REJECTED')`, [request.params.id,request.user.id,reviewerNotes || rejectionReason,record.status]);
    await audit({
      actorUserId: request.user.id,
      action: 'GIVING_REJECTED',
      entityType: 'donation',
      entityId: request.params.id,
      before: { status: record.status, paymentReference: record.payment_reference },
      after: { status: 'REJECTED', paymentReference: record.payment_reference, rejectionReason },
      ipAddress: clientIp(request),
    });
    await client.query('COMMIT');
    const notificationOutcomes = await notifyContributor(record.id, record, 'REJECTED', rejectionReason);
    return response.json({ success: true, data: { id: record.id, status: 'REJECTED', reason:rejectionReason,notificationOutcomes } });
  } catch (error) {
    await client.query('ROLLBACK');
    return requestError(error, response);
  } finally {
    client.release();
  }
}

export async function getReceipt(request, response) {
  try {
    const result = await pool.query(
      `SELECT d.*, u.name AS "userName", u.email AS "userEmail", c.name AS "categoryName", cp.title AS "campaignTitle"
       FROM donations d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN donation_categories c ON c.id = d.category_id
       LEFT JOIN fundraising_campaigns cp ON cp.id = d.campaign_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [request.params.id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Donation record not found.' });
    const record = result.rows[0];
    if (request.user && String(record.user_id) !== String(request.user.id)) return response.status(404).json({ error: 'Donation record not found.' });
    if (record.status !== 'APPROVED') {
      return response.status(409).json({ error: 'A receipt is available only after verification approval.' });
    }
    const stableNumber = record.receipt_number || receiptNumber();
    if (!record.receipt_number) await pool.query(`UPDATE donations SET receipt_number=$2 WHERE id=$1 AND status='APPROVED' AND receipt_number IS NULL`, [record.id,stableNumber]);
    const info = await churchInfo();
    return response.json({
      success: true,
      data: {
        receiptNumber: stableNumber,
        church: info,
        category: record.categoryName || 'Offering',
        amount: record.amount,
        currency: record.currency || 'ETB',
        reference: record.payment_reference || record.campaignTitle || 'Bank transfer',
        confirmedAt: record.verified_at,
        member: record.userName || record.userEmail || 'Member',
      },
    });
  } catch (error) {
    return requestError(error, response);
  }
}