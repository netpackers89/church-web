import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { requestError, requiredString } from '../utils/http.js';

const STATUSES = new Set(['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED']);

function campaignPaymentAccounts(value) {
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || value.length > 20) throw Object.assign(new Error('Provide no more than 20 campaign payment accounts.'), { status: 400 });
	return value.map((account) => {
		const name = requiredString(account?.name, 'Payment account name', 120);
		const type = String(account?.type ?? '').toUpperCase();
		if (!['BANK', 'TELEBIRR', 'OTHER'].includes(type)) throw Object.assign(new Error('Choose a valid campaign payment account type.'), { status: 400 });
		const accountHolder = typeof account.accountHolder === 'string' ? account.accountHolder.trim().slice(0, 160) || null : null;
		const accountNumber = typeof account.accountNumber === 'string' ? account.accountNumber.trim().slice(0, 80) || null : null;
		const phoneNumber = typeof account.phoneNumber === 'string' ? account.phoneNumber.trim().slice(0, 40) || null : null;
		if (type === 'TELEBIRR' ? !phoneNumber : !accountNumber) {
			throw Object.assign(new Error(type === 'TELEBIRR' ? 'Enter the Telebirr phone number.' : 'Enter the payment account number.'), { status: 400 });
		}
		const currency = typeof account.currency === 'string' ? account.currency.trim().toUpperCase() : 'ETB';
		if (!/^[A-Z]{3}$/.test(currency)) throw Object.assign(new Error('Currency must be a three-letter code.'), { status: 400 });
		const id = account.id == null || account.id === '' ? null : Number(account.id);
		if (id !== null && (!Number.isSafeInteger(id) || id < 1)) throw Object.assign(new Error('A campaign payment account ID is invalid.'), { status: 400 });
		return {
			id,
			name,
			type,
			accountHolder,
			accountNumber,
			phoneNumber,
			branch: typeof account.branch === 'string' ? account.branch.trim().slice(0, 200) || null : null,
			instructions: typeof account.instructions === 'string' ? account.instructions.trim().slice(0, 1000) || null : null,
			currency,
			isActive: account.isActive !== false,
		};
	});
}

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
	return {
		title, description, goalAmount, currency, startsAt, endsAt, status, categoryId,
		bannerUrl: optionalUrl(body.bannerUrl, 'Banner URL'),
		ctaUrl: optionalUrl(body.ctaUrl, 'Call-to-action URL'),
		paymentAccounts: campaignPaymentAccounts(body.paymentAccounts),
	};
}

const campaignAccountsSelect = `COALESCE((
	SELECT json_agg(json_build_object(
		'id',pa.id::text,'name',pa.name,'type',pa.type,'accountHolder',pa.account_holder,
		'accountNumber',pa.account_number,'phoneNumber',pa.phone_number,'branch',pa.branch,
		'instructions',pa.instructions,'currency',pa.currency,'isActive',pa.is_active
	) ORDER BY pa.id)
	FROM campaign_payment_accounts pa WHERE pa.campaign_id=c.id
), '[]'::json) AS "paymentAccounts"`;
const campaignSelect = `c.id,c.title,c.description,c.goal_amount AS "goalAmount",c.currency,c.starts_at AS "startsAt",c.ends_at AS "endsAt",c.status,c.banner_url AS "bannerUrl",c.cta_url AS "ctaUrl",c.category_id AS "categoryId",dc.name AS "category",
${campaignAccountsSelect},
COALESCE(SUM(d.amount) FILTER (WHERE d.status='APPROVED' AND d.deleted_at IS NULL AND d.currency=c.currency),0)::numeric AS "raisedAmount"`;
const campaignGroup = 'GROUP BY c.id,dc.name';

async function saveCampaignPaymentAccounts(client, campaignId, currency, accounts) {
	if (accounts === undefined) return;
	if (accounts.some((account) => account.currency !== currency)) {
		throw Object.assign(new Error('Campaign payment account currencies must match the campaign currency.'), { status: 400 });
	}
	const existingResult = await client.query('SELECT * FROM campaign_payment_accounts WHERE campaign_id=$1', [campaignId]);
	const existingAccounts = new Map(existingResult.rows.map((row) => [Number(row.id), row]));
	for (const account of accounts) {
		if (account.id !== null && !existingAccounts.has(account.id)) {
			throw Object.assign(new Error('A selected payment account does not belong to this campaign.'), { status: 400 });
		}
	}
	await client.query('UPDATE campaign_payment_accounts SET is_active=FALSE,updated_at=NOW() WHERE campaign_id=$1', [campaignId]);
	for (const account of accounts) {
		const values = [account.name,account.type,account.accountHolder,account.accountNumber,account.phoneNumber,account.branch,account.instructions,account.currency,account.isActive];
		const existing = account.id === null ? null : existingAccounts.get(account.id);
		const accountDetailsChanged = existing && (
			existing.name !== account.name
			|| existing.type !== account.type
			|| existing.account_holder !== account.accountHolder
			|| existing.account_number !== account.accountNumber
			|| existing.phone_number !== account.phoneNumber
			|| existing.branch !== account.branch
			|| existing.instructions !== account.instructions
			|| existing.currency !== account.currency
		);
		const priorContributions = accountDetailsChanged
			? await client.query('SELECT 1 FROM donations WHERE campaign_payment_account_id=$1 LIMIT 1', [account.id])
			: { rowCount: 0 };
		if (account.id === null || priorContributions.rowCount) {
			await client.query(`INSERT INTO campaign_payment_accounts(campaign_id,name,type,account_holder,account_number,phone_number,branch,instructions,currency,is_active)
				VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [campaignId,...values]);
		} else {
			await client.query(`UPDATE campaign_payment_accounts SET name=$3,type=$4,account_holder=$5,account_number=$6,phone_number=$7,branch=$8,instructions=$9,currency=$10,is_active=$11,updated_at=NOW()
				WHERE campaign_id=$1 AND id=$2`, [campaignId,account.id,...values]);
		}
	}
}

export async function listAdminCampaigns(_request, response) {
	try {
		const result = await pool.query(`SELECT ${campaignSelect} FROM fundraising_campaigns c LEFT JOIN donation_categories dc ON dc.id=c.category_id LEFT JOIN donations d ON d.campaign_id=c.id ${campaignGroup} ORDER BY c.created_at DESC`);
		return response.json({ success: true, data: result.rows });
	} catch (error) { return requestError(error, response); }
}

export async function getAdminCampaign(request, response) {
	try {
		const result = await pool.query(
			`SELECT ${campaignSelect}
			 FROM fundraising_campaigns c
			 LEFT JOIN donation_categories dc ON dc.id=c.category_id
			 LEFT JOIN donations d ON d.campaign_id=c.id
			 WHERE c.id=$1
			 ${campaignGroup}`,
			[request.params.id],
		);
		if (!result.rowCount) return response.status(404).json({ error: 'Campaign was not found.' });
		const contributions = await pool.query(
			`SELECT id::text AS id, contributor_name AS "contributorName", amount, currency,
			        status, received_at AS "receivedAt", payment_reference AS "paymentReference"
			 FROM donations
			 WHERE campaign_id=$1 AND deleted_at IS NULL
			 ORDER BY received_at DESC, id DESC
			 LIMIT 100`,
			[request.params.id],
		);
		return response.json({
			success: true,
			data: { ...result.rows[0], contributions: contributions.rows },
		});
	} catch (error) { return requestError(error, response); }
}

export async function createCampaign(request, response) {
	const client = await pool.connect();
	let transactionStarted = false;
	try {
		const data = campaignValues(request.body ?? {});
		if (data.categoryId) {
			const category = await client.query('SELECT id FROM donation_categories WHERE id=$1 AND is_active=TRUE', [data.categoryId]);
			if (!category.rowCount) return response.status(404).json({ error: 'Giving category was not found or is inactive.' });
		}
		await client.query('BEGIN');
		transactionStarted = true;
		const result = await client.query(`INSERT INTO fundraising_campaigns(title,description,goal_amount,currency,starts_at,ends_at,status,category_id,banner_url,cta_url,created_by)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,title,status`, [data.title,data.description,data.goalAmount,data.currency,data.startsAt,data.endsAt,data.status,data.categoryId,data.bannerUrl,data.ctaUrl,request.user.id]);
		await saveCampaignPaymentAccounts(client, result.rows[0].id, data.currency, data.paymentAccounts);
		await client.query('COMMIT');
		transactionStarted = false;
		await audit({ actorUserId: request.user.id, action: 'CAMPAIGN_CREATED', entityType: 'fundraising_campaign', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) });
		return response.status(201).json({ success: true, data: result.rows[0] });
	} catch (error) {
		if (transactionStarted) {
			try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('[campaign create] rollback failed:', rollbackError.message); }
		}
		return requestError(error, response);
	} finally { client.release(); }
}

export async function updateCampaign(request, response) {
	const client = await pool.connect();
	let transactionStarted = false;
	try {
		const existing = await client.query('SELECT * FROM fundraising_campaigns WHERE id=$1', [request.params.id]);
		if (!existing.rowCount) return response.status(404).json({ error: 'Campaign was not found.' });
		const data = campaignValues({ ...existing.rows[0], ...request.body, goalAmount: request.body?.goalAmount ?? existing.rows[0].goal_amount, startsAt: request.body?.startsAt ?? existing.rows[0].starts_at, endsAt: request.body?.endsAt ?? existing.rows[0].ends_at, categoryId: request.body?.categoryId ?? existing.rows[0].category_id, bannerUrl: request.body?.bannerUrl ?? existing.rows[0].banner_url, ctaUrl: request.body?.ctaUrl ?? existing.rows[0].cta_url });
		await client.query('BEGIN');
		transactionStarted = true;
		if (data.categoryId) {
			const category = await client.query('SELECT id FROM donation_categories WHERE id=$1 AND is_active=TRUE', [data.categoryId]);
			if (!category.rowCount) throw Object.assign(new Error('Giving category was not found or is inactive.'), { status: 404 });
		}
		const result = await client.query(`UPDATE fundraising_campaigns SET title=$2,description=$3,goal_amount=$4,currency=$5,starts_at=$6,ends_at=$7,status=$8,category_id=$9,banner_url=$10,cta_url=$11,updated_at=NOW() WHERE id=$1 RETURNING id,title,status`, [request.params.id,data.title,data.description,data.goalAmount,data.currency,data.startsAt,data.endsAt,data.status,data.categoryId,data.bannerUrl,data.ctaUrl]);
		await saveCampaignPaymentAccounts(client, request.params.id, data.currency, data.paymentAccounts);
		await client.query('COMMIT');
		transactionStarted = false;
		await audit({ actorUserId: request.user.id, action: 'CAMPAIGN_UPDATED', entityType: 'fundraising_campaign', entityId: request.params.id, before: existing.rows[0], after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) {
		if (transactionStarted) {
			try { await client.query('ROLLBACK'); } catch (rollbackError) { console.error('[campaign update] rollback failed:', rollbackError.message); }
		}
		return requestError(error, response);
	} finally { client.release(); }
}

export async function archiveCampaign(request, response) {
	try {
		const result = await pool.query(`UPDATE fundraising_campaigns SET status='ARCHIVED',updated_at=NOW() WHERE id=$1 AND status<>'ARCHIVED' RETURNING id,title,status`, [request.params.id]);
		if (!result.rowCount) return response.status(404).json({ error: 'Campaign was not found or is already archived.' });
		await audit({ actorUserId: request.user.id, action: 'CAMPAIGN_ARCHIVED', entityType: 'fundraising_campaign', entityId: request.params.id, after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}
