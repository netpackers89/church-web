import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { requestError, requiredString } from '../utils/http.js';

const STATUSES = new Set(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']);

function optionalUrl(value, label) {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value !== 'string' || value.length > 2000) throw Object.assign(new Error(`${label} must be a valid http(s) URL.`), { status: 400 });
	try {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
		return url.href;
	} catch { throw Object.assign(new Error(`${label} must be a valid http(s) URL.`), { status: 400 }); }
}

function campaignValues(body) {
	const title = requiredString(body.title, 'Title', 200);
	const description = typeof body.description === 'string' ? body.description.trim().slice(0, 10000) || null : null;
	const goalAmount = body.goalAmount === '' || body.goalAmount === null || body.goalAmount === undefined ? null : Number(body.goalAmount);
	if (goalAmount !== null && (!Number.isFinite(goalAmount) || goalAmount < 0)) throw Object.assign(new Error('Goal amount must be zero or greater.'), { status: 400 });
	const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'ETB';
	if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Currency must be a three-letter code.'), { status: 400 });
	const startsAt = body.startsAt ? new Date(body.startsAt) : null;
	const endsAt = body.endsAt ? new Date(body.endsAt) : null;
	if ((startsAt && Number.isNaN(startsAt.valueOf())) || (endsAt && Number.isNaN(endsAt.valueOf())) || (startsAt && endsAt && endsAt <= startsAt)) throw Object.assign(new Error('Provide valid campaign dates; the end must be after the start.'), { status: 400 });
	const status = String(body.status ?? 'DRAFT').toUpperCase();
	if (!STATUSES.has(status)) throw Object.assign(new Error('Invalid campaign status.'), { status: 400 });
	const categoryId = body.categoryId === '' || body.categoryId === null || body.categoryId === undefined ? null : Number(body.categoryId);
	if (categoryId !== null && (!Number.isSafeInteger(categoryId) || categoryId < 1)) throw Object.assign(new Error('Select a valid giving category.'), { status: 400 });
	return { title, description, goalAmount, currency, startsAt, endsAt, status, categoryId, bannerUrl: optionalUrl(body.bannerUrl, 'Banner URL'), ctaUrl: optionalUrl(body.ctaUrl, 'Call-to-action URL') };
}

const campaignSelect = `c.id,c.title,c.description,c.goal_amount AS "goalAmount",c.currency,c.starts_at AS "startsAt",c.ends_at AS "endsAt",c.status,c.banner_url AS "bannerUrl",c.cta_url AS "ctaUrl",c.category_id AS "categoryId",dc.name AS "category",
COALESCE(SUM(d.amount) FILTER (WHERE d.status='APPROVED' AND d.deleted_at IS NULL AND d.currency=c.currency),0)::numeric AS "raisedAmount"`;
const campaignGroup = 'GROUP BY c.id,dc.name';

export async function listAdminCampaigns(_request, response) {
	try {
		const result = await pool.query(`SELECT ${campaignSelect} FROM fundraising_campaigns c LEFT JOIN donation_categories dc ON dc.id=c.category_id LEFT JOIN donations d ON d.campaign_id=c.id ${campaignGroup} ORDER BY c.created_at DESC`);
		return response.json({ success: true, data: result.rows });
	} catch (error) { return requestError(error, response); }
}

export async function createCampaign(request, response) {
	try {
		const data = campaignValues(request.body ?? {});
		if (data.categoryId) {
			const category = await pool.query('SELECT id FROM donation_categories WHERE id=$1 AND is_active=TRUE', [data.categoryId]);
			if (!category.rowCount) return response.status(404).json({ error: 'Giving category was not found or is inactive.' });
		}
		const result = await pool.query(`INSERT INTO fundraising_campaigns(title,description,goal_amount,currency,starts_at,ends_at,status,category_id,banner_url,cta_url,created_by)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,title,status`, [data.title,data.description,data.goalAmount,data.currency,data.startsAt,data.endsAt,data.status,data.categoryId,data.bannerUrl,data.ctaUrl,request.user.id]);
		await audit({ actorUserId: request.user.id, action: 'CAMPAIGN_CREATED', entityType: 'fundraising_campaign', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) });
		return response.status(201).json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function updateCampaign(request, response) {
	try {
		const existing = await pool.query('SELECT * FROM fundraising_campaigns WHERE id=$1', [request.params.id]);
		if (!existing.rowCount) return response.status(404).json({ error: 'Campaign was not found.' });
		const data = campaignValues({ ...existing.rows[0], ...request.body, goalAmount: request.body?.goalAmount ?? existing.rows[0].goal_amount, startsAt: request.body?.startsAt ?? existing.rows[0].starts_at, endsAt: request.body?.endsAt ?? existing.rows[0].ends_at, categoryId: request.body?.categoryId ?? existing.rows[0].category_id, bannerUrl: request.body?.bannerUrl ?? existing.rows[0].banner_url, ctaUrl: request.body?.ctaUrl ?? existing.rows[0].cta_url });
		const result = await pool.query(`UPDATE fundraising_campaigns SET title=$2,description=$3,goal_amount=$4,currency=$5,starts_at=$6,ends_at=$7,status=$8,category_id=$9,banner_url=$10,cta_url=$11,updated_at=NOW() WHERE id=$1 RETURNING id,title,status`, [request.params.id,data.title,data.description,data.goalAmount,data.currency,data.startsAt,data.endsAt,data.status,data.categoryId,data.bannerUrl,data.ctaUrl]);
		await audit({ actorUserId: request.user.id, action: 'CAMPAIGN_UPDATED', entityType: 'fundraising_campaign', entityId: request.params.id, before: existing.rows[0], after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function archiveCampaign(request, response) {
	try {
		const result = await pool.query(`UPDATE fundraising_campaigns SET status='ARCHIVED',updated_at=NOW() WHERE id=$1 AND status<>'ARCHIVED' RETURNING id,title,status`, [request.params.id]);
		if (!result.rowCount) return response.status(404).json({ error: 'Campaign was not found or is already archived.' });
		await audit({ actorUserId: request.user.id, action: 'CAMPAIGN_ARCHIVED', entityType: 'fundraising_campaign', entityId: request.params.id, after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}
