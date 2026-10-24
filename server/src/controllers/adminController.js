import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { pageParams, paged, requestError, requiredString } from '../utils/http.js';
import { assertRoleAssignmentAllowed, normaliseRoleCodes, primaryRole, SYSTEM_OWNER } from '../services/roleAssignmentPolicy.js';
import { sendTelegramNotification } from '../telegram/services/messaging.js';
import { sendEmailNotification } from '../email/index.js';
import { validateAudience, renderEmailHtml } from '../services/notificationStudioService.js';

// The settings endpoint is intentionally an allow-list.  System settings can
// also contain integration credentials, which must never be returned to a
// browser or accepted through this general-purpose administration form.
const TEXT_SETTING_LIMITS = Object.freeze({
	churchName: 160, logoUrl: 2000, faviconUrl: 2000, contactEmail: 320,
	contactPhone: 40, address: 500, mapUrl: 2000, serviceTimes: 500,
	socialFacebook: 2000, socialInstagram: 2000, socialYoutube: 2000,
	bankName: 160, accountHolder: 160, accountNumber: 120, bankBranch: 160,
	transferInstructions: 1000, currency: 8,
});
const SELECT_SETTING_VALUES = Object.freeze({
	publicSiteStatus: ['LIVE', 'MAINTENANCE'],
	defaultTheme: ['SYSTEM', 'LIGHT', 'DARK'],
	defaultLanguage: ['en', 'am'],
	calendarSystem: ['ETHIOPIAN', 'GREGORIAN'],
});
const SAFE_SETTING_KEYS = Object.freeze([
	...Object.keys(TEXT_SETTING_LIMITS), ...Object.keys(SELECT_SETTING_VALUES),
	'paymentMethods', 'bank_account',
]);
const URL_SETTING_KEYS = new Set(['logoUrl', 'faviconUrl', 'mapUrl', 'socialFacebook', 'socialInstagram', 'socialYoutube']);

function validateSettingsPayload(body) {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw Object.assign(new Error('Provide one or more valid settings.'), { status: 400 });
	}
	const entries = Object.entries(body);
	if (!entries.length || entries.some(([key]) => !SAFE_SETTING_KEYS.includes(key))) {
		throw Object.assign(new Error('One or more settings cannot be changed here.'), { status: 400 });
	}
	for (const [key, value] of entries) {
		if (key in TEXT_SETTING_LIMITS && (typeof value !== 'string' || value.length > TEXT_SETTING_LIMITS[key])) {
			throw Object.assign(new Error(`${key} must be a valid text value.`), { status: 400 });
		}
		if (key === 'churchName' && !value.trim()) {
			throw Object.assign(new Error('churchName is required.'), { status: 400 });
		}
		if (key === 'contactEmail' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
			throw Object.assign(new Error('contactEmail must be a valid email address.'), { status: 400 });
		}
		if (URL_SETTING_KEYS.has(key) && value) {
			try { new URL(value); } catch { throw Object.assign(new Error(`${key} must be a valid URL.`), { status: 400 }); }
		}
		if (key in SELECT_SETTING_VALUES && !SELECT_SETTING_VALUES[key].includes(value)) {
			throw Object.assign(new Error(`${key} has an invalid value.`), { status: 400 });
		}
		if (key === 'paymentMethods' && (!Array.isArray(value) || value.length > 20)) {
			throw Object.assign(new Error('paymentMethods must be a list of at most 20 payment methods.'), { status: 400 });
		}
		if (key === 'paymentMethods' && value.some((method) => !method || typeof method !== 'object' || Array.isArray(method) || typeof method.name !== 'string' || method.name.length > 160 || !['BANK', 'TELEBIRR', 'OTHER'].includes(method.type))) {
			throw Object.assign(new Error('Each payment method must include a valid name and type.'), { status: 400 });
		}
		if (key === 'bank_account' && (!value || typeof value !== 'object' || Array.isArray(value))) {
			throw Object.assign(new Error('bank_account must be a valid account object.'), { status: 400 });
		}
	}
	return entries;
}

export async function roles(_request, response) {
	try {
		const result = await pool.query(`SELECT r.id,r.code,r.name,r.description,r.is_system AS "isSystem",
			COALESCE(json_agg(json_build_object('id',p.id,'code',p.code,'description',p.description)) FILTER (WHERE p.id IS NOT NULL),'[]') AS permissions
			FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id GROUP BY r.id ORDER BY r.code`);
		return response.json({ success: true, data: result.rows });
	} catch (error) { return requestError(error, response); }
}

export async function setUserRoles(request, response) {
	const client = await pool.connect();
	try {
		const codes = normaliseRoleCodes(request.body?.roles);
		const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : null;
		if (reason && reason.length > 500) throw Object.assign(new Error('reason must be 500 characters or fewer.'), { status: 400 });
		await client.query('BEGIN');
		const target = await client.query('SELECT id, role, account_status FROM users WHERE id=$1 FOR UPDATE', [request.params.userId]);
		if (!target.rowCount) throw Object.assign(new Error('User not found.'), { status: 404 });
		const currentRoles = await client.query(`SELECT r.id, r.code FROM user_roles ur
			JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1 FOR UPDATE`, [request.params.userId]);
		const oldCodes = currentRoles.rows.map((role) => role.code);
		assertRoleAssignmentAllowed({ actorRoles: request.user.roles, actorPermissions: request.user.permissions, targetRoles: oldCodes, nextRoles: codes, actorId: request.user.id, targetUserId: request.params.userId });
		const matched = await client.query('SELECT id,code FROM roles WHERE code = ANY($1::varchar[])', [codes]);
		if (matched.rowCount !== codes.length) throw Object.assign(new Error('One or more roles do not exist.'), { status: 400 });
		if (oldCodes.includes(SYSTEM_OWNER) && !codes.includes(SYSTEM_OWNER)) {
			const owners = await client.query(`SELECT count(*)::int AS count FROM users u
				JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
				WHERE u.account_status = 'ACTIVE' AND r.code = $1`, [SYSTEM_OWNER]);
			if (owners.rows[0].count <= 1) throw Object.assign(new Error('The last active system owner cannot be removed.'), { status: 409 });
		}
		const nextRoleIds = new Set(matched.rows.map((role) => String(role.id)));
		const revoked = currentRoles.rows.filter((role) => !nextRoleIds.has(String(role.id)));
		const granted = matched.rows.filter((role) => !currentRoles.rows.some((current) => String(current.id) === String(role.id)));
		if (revoked.length) {
			await client.query(`UPDATE user_role_assignment_history
				SET revoked_at = NOW(), revoked_by = $2
				WHERE user_id = $1 AND role_id = ANY($3::bigint[]) AND revoked_at IS NULL`, [request.params.userId, request.user.id, revoked.map((role) => role.id)]);
		}
		await client.query('DELETE FROM user_roles WHERE user_id=$1', [request.params.userId]);
		await client.query('INSERT INTO user_roles (user_id,role_id,assigned_by) SELECT $1,id,$2 FROM roles WHERE code = ANY($3::varchar[])', [request.params.userId, request.user.id, codes]);
		for (const role of granted) {
			await client.query(`INSERT INTO user_role_assignment_history (user_id, role_id, granted_by, reason)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT (user_id, role_id) WHERE revoked_at IS NULL DO NOTHING`, [request.params.userId, role.id, request.user.id, reason]);
		}
		// role remains a legacy summary for older pages. Authorization always uses user_roles.
		const primary = primaryRole(codes);
		await client.query('UPDATE users SET role=$2,updated_at=NOW() WHERE id=$1', [request.params.userId, primary]);
		await client.query('COMMIT');
		await audit({ actorUserId: request.user.id, action: 'USER_ROLES_SET', entityType: 'user', entityId: request.params.userId, before: { role: target.rows[0].role, roles: oldCodes }, after: { roles: codes, reason }, ipAddress: clientIp(request) });
		return response.json({ success: true, data: { userId: Number(request.params.userId), roles: codes } });
	} catch (error) { await client.query('ROLLBACK'); return requestError(error, response); } finally { client.release(); }
}

export async function updateUserStatus(request, response) {
	const client = await pool.connect();
	try {
		const status = request.body?.status;
		if (!['ACTIVE', 'DEACTIVATED'].includes(status)) throw Object.assign(new Error('status must be ACTIVE or DEACTIVATED.'), { status: 400 });
		if (String(request.params.userId) === String(request.user.id) && status !== 'ACTIVE') throw Object.assign(new Error('You cannot suspend your own account.'), { status: 400 });
		await client.query('BEGIN');
		const target = await client.query('SELECT id, account_status FROM users WHERE id=$1 FOR UPDATE', [request.params.userId]);
		if (!target.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'User not found.' }); }
		const targetRoles = await client.query(`SELECT r.code FROM user_roles ur
			JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`, [request.params.userId]);
		if (targetRoles.rows.some((role) => role.code === SYSTEM_OWNER) && !request.user.roles.includes(SYSTEM_OWNER)) {
			throw Object.assign(new Error('Only a system owner can change a system owner account.'), { status: 403 });
		}
		if (status === 'DEACTIVATED') {
			if (targetRoles.rows.some((role) => role.code === SYSTEM_OWNER)) {
				const owners = await client.query(`SELECT count(*)::int AS count FROM users u
					JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
					WHERE u.account_status='ACTIVE' AND r.code=$1`, [SYSTEM_OWNER]);
				if (owners.rows[0].count <= 1) throw Object.assign(new Error('The last active system owner cannot be deactivated.'), { status: 409 });
			}
		}
		const result = await client.query(`UPDATE users SET account_status=$2,session_version=session_version + CASE WHEN $2='DEACTIVATED' THEN 1 ELSE 0 END,updated_at=NOW() WHERE id=$1 RETURNING id,account_status AS "accountStatus"`, [request.params.userId, status]);
		await client.query('COMMIT');
		if (!result.rowCount) return response.status(404).json({ error: 'User not found.' });
		await audit({ actorUserId: request.user.id, action: 'USER_STATUS_SET', entityType: 'user', entityId: request.params.userId, after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { await client.query('ROLLBACK'); return requestError(error, response); } finally { client.release(); }
}

export async function settings(_request, response) {
	try {
		const result = await pool.query('SELECT key,value FROM system_settings WHERE key = ANY($1::varchar[]) ORDER BY key', [SAFE_SETTING_KEYS]);
		return response.json({ success: true, data: Object.fromEntries(result.rows.map((row) => [row.key, row.value])) });
	} catch (error) { return requestError(error, response); }
}

export async function listGivingRecords(_request, response) {
	try {
		const result = await pool.query(`
			SELECT d.id, d.amount, d.currency, d.status,
			       d.payment_reference AS "paymentReference",
			       d.received_at AS "receivedAt",
			       d.created_at AS "createdAt",
			       u.name AS "memberName",
			       c.name AS "categoryName",
			       cp.title AS "campaignTitle"
			FROM donations d
			LEFT JOIN users u ON u.id = d.user_id
			LEFT JOIN donation_categories c ON c.id = d.category_id
			LEFT JOIN fundraising_campaigns cp ON cp.id = d.campaign_id
			ORDER BY d.created_at DESC
		`);
		return response.json({ success: true, data: result.rows });
	} catch (error) { return requestError(error, response); }
}

export async function reviewGivingRecord(request, response) {
	try {
		const status = String(request.body?.status || '').toUpperCase();
		if (!['APPROVED', 'REJECTED'].includes(status)) throw Object.assign(new Error('status must be APPROVED or REJECTED.'), { status: 400 });
		const recordResult = await pool.query('SELECT id, user_id, status FROM donations WHERE id = $1 FOR UPDATE', [request.params.id]);
		if (!recordResult.rowCount) return response.status(404).json({ error: 'Giving record was not found.' });
		if (Number(recordResult.rows[0].user_id) === Number(request.user.id)) throw Object.assign(new Error('You cannot approve your own giving record.'), { status: 403 });
		const result = await pool.query(`
			UPDATE donations
			SET status = $2,
			    recorded_by = $3,
			    received_at = COALESCE(received_at, NOW())
			WHERE id = $1
			RETURNING id, amount, currency, status, payment_reference AS "paymentReference", received_at AS "receivedAt", created_at AS "createdAt"
		`, [request.params.id, status, request.user.id]);
		return response.json({ success: true, data: result.rows[0], message: status === 'APPROVED' ? 'Giving record approved.' : 'Giving record rejected.' });
	} catch (error) { return requestError(error, response); }
}

export async function updateSettings(request, response) {
	let client;
	try {
		const entries = validateSettingsPayload(request.body);
		client = await pool.connect();
		await client.query('BEGIN');
		for (const [key, value] of entries) await client.query(
			`INSERT INTO system_settings(key,value) VALUES($1,$2::jsonb)
			 ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,
			[key, JSON.stringify(value)],
		);
		await audit({ actorUserId: request.user.id, action: 'SETTINGS_UPDATED', entityType: 'system_settings', after: Object.fromEntries(entries), ipAddress: clientIp(request) }, client);
		await client.query('COMMIT');
		return response.json({ success: true, message: 'Settings updated.' });
	} catch (error) {
		if (client) await client.query('ROLLBACK').catch(() => {});
		return requestError(error, response);
	} finally {
		client?.release();
	}
}

export async function publishVerse(request, response) {
	const client = await pool.connect();
	try {
		const body = request.body ?? {};
		const text = requiredString(body.text, 'Verse text', 5000);
		const reference = requiredString(body.reference, 'Verse reference', 200);
		const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?(?:\s*\(([^)]+)\))?$/);
		if (!match) throw Object.assign(new Error('Use a verified reference such as John 3:16 (WEB).'), { status: 400 });
		const [, book, chapter, verseStart, verseEnd, translation = 'UNSPECIFIED'] = match;
		const publicationDate = body.publicationDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa' }).format(new Date());
		if (!/^\d{4}-\d{2}-\d{2}$/.test(publicationDate)) throw Object.assign(new Error('publicationDate must be YYYY-MM-DD.'), { status: 400 });
		await client.query('BEGIN');
		const exactVerse = await client.query(`SELECT id FROM bible_verses WHERE book=$1 AND chapter=$2 AND verse_start=$3 AND COALESCE(verse_end,verse_start)=COALESCE($4,$3) AND translation=$5 AND language=$6 FOR UPDATE`, [book.trim(), Number(chapter), Number(verseStart), verseEnd ? Number(verseEnd) : null, translation.trim(), body.language || 'en']);
		const verse = exactVerse.rowCount
			? await client.query(`UPDATE bible_verses SET verse_text=$2,source_attribution=$3,verified_at=NOW(),verified_by=$4,updated_at=NOW() WHERE id=$1 RETURNING id`, [exactVerse.rows[0].id, text, requiredString(body.sourceAttribution || 'Administrator verified import', 'Source attribution', 500), request.user.id])
			: await client.query(`INSERT INTO bible_verses (book,chapter,verse_start,verse_end,verse_text,translation,language,source_attribution,verified_at,verified_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,NOW()) RETURNING id`, [book.trim(), Number(chapter), Number(verseStart), verseEnd ? Number(verseEnd) : null, text, translation.trim(), body.language || 'en', requiredString(body.sourceAttribution || 'Administrator verified import', 'Source attribution', 500), request.user.id]);
		await client.query(`UPDATE daily_verse_publications SET status='UNPUBLISHED',updated_at=NOW() WHERE publication_date=$1 AND status IN ('SCHEDULED','PUBLISHED')`, [publicationDate]);
		const publicationStatus = ['SCHEDULED','PUBLISHED','UNPUBLISHED'].includes(body.status) ? body.status : (body.schedule ? 'SCHEDULED' : 'PUBLISHED');
		const publishedAt = publicationStatus === 'PUBLISHED' ? new Date() : null;
		const published = await client.query(`INSERT INTO daily_verse_publications (verse_id,publication_date,reflection,explanation,publication_source,status,publish_to_website,publish_to_telegram,background_image_url,published_by,published_at)
			VALUES($1,$2,$3,$4,'MANUAL',$5,$6,$7,$8,$9,$10) RETURNING id`, [verse.rows[0].id, publicationDate, body.reflection || null, body.explanation || null, publicationStatus, body.publishToWebsite !== false, Boolean(body.publishToTelegram), typeof body.backgroundImageUrl === 'string' ? body.backgroundImageUrl.slice(0, 2000) : null, request.user.id, publishedAt]);
		await client.query(`INSERT INTO bible_verse_publication_history(publication_id,action,snapshot,changed_by) VALUES($1,'MANUAL_PUBLISHED',$2::jsonb,$3)`, [published.rows[0].id, JSON.stringify({ reference, publicationDate }), request.user.id]);
		await client.query('COMMIT');
		await audit({ actorUserId: request.user.id, action: 'VERSE_PUBLISHED', entityType: 'daily_verse_publication', entityId: published.rows[0].id, ipAddress: clientIp(request) });
		return response.status(201).json({ success: true, data: { id: published.rows[0].id } });
	} catch (error) { await client.query('ROLLBACK'); return requestError(error, response); } finally { client.release(); }
}

export async function listVersePublications(_request, response) {
	try {
		const result = await pool.query(`SELECT p.id,p.publication_date AS "publicationDate",p.status,p.publish_to_website AS "publishToWebsite",p.reflection,p.explanation,p.background_image_url AS "backgroundImageUrl",v.verse_text AS text,v.book,v.chapter,v.verse_start AS "verseStart",v.verse_end AS "verseEnd",v.translation
			FROM daily_verse_publications p JOIN bible_verses v ON v.id=p.verse_id ORDER BY p.publication_date DESC,p.created_at DESC LIMIT 200`);
		return response.json({ success: true, data: result.rows.map((verse) => ({ ...verse, reference: `${verse.book} ${verse.chapter}:${verse.verseStart}${verse.verseEnd ? `-${verse.verseEnd}` : ''} (${verse.translation})` })) });
	} catch (error) { return requestError(error, response); }
}

export async function updateVersePublication(request, response) {
	try {
		const body = request.body ?? {}; const status = body.status;
		if (status !== undefined && !['SCHEDULED','PUBLISHED','UNPUBLISHED','CANCELLED'].includes(status)) throw Object.assign(new Error('Invalid verse publication status.'), { status: 400 });
		const publishedAt = status === 'PUBLISHED' ? new Date() : null;
		const result = await pool.query(`UPDATE daily_verse_publications SET status=COALESCE($2,status),publish_to_website=COALESCE($3,publish_to_website),reflection=COALESCE($4,reflection),explanation=COALESCE($5,explanation),background_image_url=COALESCE($6,background_image_url),published_at=COALESCE($7,published_at),updated_at=NOW() WHERE id=$1 RETURNING id,status`, [request.params.id,status,typeof body.publishToWebsite === 'boolean' ? body.publishToWebsite : null,typeof body.reflection === 'string' ? body.reflection : null,typeof body.explanation === 'string' ? body.explanation : null,typeof body.backgroundImageUrl === 'string' ? body.backgroundImageUrl.slice(0,2000) : null, publishedAt]);
		if (!result.rowCount) return response.status(404).json({ error: 'Verse publication was not found.' });
		await audit({ actorUserId: request.user.id, action: 'VERSE_PUBLICATION_UPDATED', entityType: 'daily_verse_publication', entityId: request.params.id, after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function archiveVersePublication(request, response) {
	try { const result = await pool.query(`UPDATE daily_verse_publications SET status='CANCELLED',updated_at=NOW() WHERE id=$1 AND status<>'CANCELLED' RETURNING id,status`, [request.params.id]); if (!result.rowCount) return response.status(404).json({ error: 'Verse publication was not found.' }); return response.json({ success: true, data: result.rows[0] }); } catch (error) { return requestError(error, response); }
}

export async function createAnnouncement(request, response) {
	try {
		const title = requiredString(request.body?.title, 'Title', 200);
		const body = requiredString(request.body?.body, 'Body', 10000);
		const status = request.body?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
		const imageUrl = typeof request.body?.imageUrl === 'string' && request.body.imageUrl.trim() ? request.body.imageUrl.trim() : null;
		if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) {
			throw Object.assign(new Error('Announcement image URL must be a valid URL.'), { status: 400 });
		}
		const departmentId = request.body?.departmentId ? Number(request.body.departmentId) : null;
		const organizationId = request.body?.organizationId ? Number(request.body.organizationId) : null;
		const bibleStudyGroupId = request.body?.bibleStudyGroupId ? Number(request.body.bibleStudyGroupId) : null;
		const eventId = request.body?.eventId ? Number(request.body.eventId) : null;
		const programId = request.body?.programId ? Number(request.body.programId) : null;
		const featured = Boolean(request.body?.featured);
		const targetAudience = typeof request.body?.targetAudience === 'string' ? request.body.targetAudience.trim().toUpperCase() : (departmentId ? 'DEPARTMENT' : organizationId ? 'ORGANIZATION' : bibleStudyGroupId ? 'BIBLE_STUDY' : 'CHURCH');
		const deliveryChannels = Array.isArray(request.body?.deliveryChannels) ? request.body.deliveryChannels : ['WEBSITE'];

		// Verify permission: global admin or leader of the targeted group
		const hasGlobalManage = (request.user?.permissions ?? []).includes('announcements.manage') || (request.user?.permissions ?? []).includes('system.owner.manage');
		if (!hasGlobalManage) {
			let isLeader = false;
			if (departmentId) {
				const check = await pool.query('SELECT 1 FROM departments WHERE id = $1 AND leader_user_id = $2 AND deleted_at IS NULL', [departmentId, request.user.id]);
				if (check.rowCount) isLeader = true;
			}
			if (bibleStudyGroupId && !isLeader) {
				const check = await pool.query('SELECT 1 FROM bible_study_groups WHERE id = $1 AND leader_user_id = $2 AND deleted_at IS NULL', [bibleStudyGroupId, request.user.id]);
				if (check.rowCount) isLeader = true;
			}
			if (organizationId && !isLeader) {
				const check = await pool.query('SELECT 1 FROM organizations WHERE id = $1 AND leader_user_id = $2 AND deleted_at IS NULL', [organizationId, request.user.id]);
				if (check.rowCount) isLeader = true;
			}
			if (!isLeader) {
				throw Object.assign(new Error('You do not have permission to publish announcements for this group.'), { status: 403 });
			}
		}

		const publishedAt = status === 'PUBLISHED' ? new Date() : null;
		const result = await pool.query(
			`INSERT INTO announcements(title, body, status, image_url, published_at, created_by, department_id, organization_id, bible_study_group_id, event_id, program_id, featured, target_audience, delivery_channels)
			 VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
			 RETURNING id, title, body, status, image_url AS "imageUrl", published_at AS "publishedAt", created_by AS "createdBy",
			 department_id AS "departmentId", organization_id AS "organizationId", bible_study_group_id AS "bibleStudyGroupId",
			 event_id AS "eventId", program_id AS "programId", featured, target_audience AS "targetAudience", delivery_channels AS "deliveryChannels"`,
			[title, body, status, imageUrl, publishedAt, request.user.id, departmentId, organizationId, bibleStudyGroupId, eventId, programId, featured, targetAudience, JSON.stringify(deliveryChannels)]
		);
		await audit({ actorUserId: request.user.id, action: 'ANNOUNCEMENT_CREATED', entityType: 'announcement', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) });
		return response.status(201).json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function listAnnouncements(request, response) {
  try {
    const { page, limit, offset } = pageParams(request.query);
    const departmentId = request.query.departmentId ? Number(request.query.departmentId) : null;
    const organizationId = request.query.organizationId ? Number(request.query.organizationId) : null;
    const bibleStudyGroupId = request.query.bibleStudyGroupId ? Number(request.query.bibleStudyGroupId) : null;

    let whereClause = 'WHERE a.deleted_at IS NULL';
    const params = [limit, offset];
    let paramIndex = 3;

    if (departmentId) {
      whereClause += ` AND a.department_id = $${paramIndex++}`;
      params.push(departmentId);
    } else if (organizationId) {
      whereClause += ` AND a.organization_id = $${paramIndex++}`;
      params.push(organizationId);
    } else if (bibleStudyGroupId) {
      whereClause += ` AND a.bible_study_group_id = $${paramIndex++}`;
      params.push(bibleStudyGroupId);
    }

    const result = await pool.query(
      `SELECT a.id, a.title, a.body, a.status, a.image_url AS "imageUrl", a.published_at AS "publishedAt", a.created_by AS "createdBy",
       a.department_id AS "departmentId", a.organization_id AS "organizationId", a.bible_study_group_id AS "bibleStudyGroupId",
       a.event_id AS "eventId", a.program_id AS "programId", a.featured, a.target_audience AS "targetAudience", a.delivery_channels AS "deliveryChannels",
       d.name AS "departmentName", g.name AS "groupName", o.name AS "organizationName"
       FROM announcements a
       LEFT JOIN departments d ON d.id = a.department_id
       LEFT JOIN bible_study_groups g ON g.id = a.bible_study_group_id
       LEFT JOIN organizations o ON o.id = a.organization_id
       ${whereClause}
       ORDER BY CASE WHEN a.status = 'PUBLISHED' THEN 0 ELSE 1 END, a.published_at DESC NULLS LAST, a.id DESC
       LIMIT $1 OFFSET $2`,
      params,
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) { return requestError(error, response); }
}

export async function updateAnnouncement(request, response) {
	try {
		const existing = await pool.query('SELECT * FROM announcements WHERE id=$1 AND deleted_at IS NULL', [request.params.id]);
		if (!existing.rowCount) return response.status(404).json({ error: 'Announcement was not found.' });
		const data = { ...existing.rows[0], ...(request.body ?? {}) };
		const title = requiredString(data.title, 'Title', 200);
		const body = requiredString(data.body, 'Body', 10000);
		const status = String(data.status || 'DRAFT').toUpperCase();
		if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) throw Object.assign(new Error('Status must be DRAFT, PUBLISHED, or ARCHIVED.'), { status: 400 });
		const imageUrl = typeof data.imageUrl === 'string' && data.imageUrl.trim() ? data.imageUrl.trim() : (typeof data.image_url === 'string' ? data.image_url.trim() : null);
		if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) throw Object.assign(new Error('Announcement image URL must be a valid URL.'), { status: 400 });

		const publishedAt = status === 'PUBLISHED' ? (existing.rows[0].published_at || new Date()) : null;
		const departmentId = request.body?.departmentId !== undefined ? (request.body.departmentId ? Number(request.body.departmentId) : null) : existing.rows[0].department_id;
		const organizationId = request.body?.organizationId !== undefined ? (request.body.organizationId ? Number(request.body.organizationId) : null) : existing.rows[0].organization_id;
		const bibleStudyGroupId = request.body?.bibleStudyGroupId !== undefined ? (request.body.bibleStudyGroupId ? Number(request.body.bibleStudyGroupId) : null) : existing.rows[0].bible_study_group_id;
		const eventId = request.body?.eventId !== undefined ? (request.body.eventId ? Number(request.body.eventId) : null) : existing.rows[0].event_id;
		const programId = request.body?.programId !== undefined ? (request.body.programId ? Number(request.body.programId) : null) : existing.rows[0].program_id;
		const featured = request.body?.featured !== undefined ? Boolean(request.body.featured) : existing.rows[0].featured;
		const targetAudience = request.body?.targetAudience || existing.rows[0].target_audience || 'CHURCH';
		const deliveryChannels = request.body?.deliveryChannels || existing.rows[0].delivery_channels || ['WEBSITE'];

		const result = await pool.query(`UPDATE announcements SET title=$2,body=$3,status=$4,image_url=$5,published_at=$6,updated_at=NOW(),
			department_id=$7,organization_id=$8,bible_study_group_id=$9,event_id=$10,program_id=$11,featured=$12,target_audience=$13,delivery_channels=$14::jsonb
			WHERE id=$1 RETURNING id,title,body,status,image_url AS "imageUrl",published_at AS "publishedAt",
			department_id AS "departmentId",organization_id AS "organizationId",bible_study_group_id AS "bibleStudyGroupId",
			event_id AS "eventId",program_id AS "programId",featured,target_audience AS "targetAudience",delivery_channels AS "deliveryChannels"`,
		[request.params.id, title, body, status, imageUrl, publishedAt, departmentId, organizationId, bibleStudyGroupId, eventId, programId, featured, targetAudience, JSON.stringify(deliveryChannels)]);
		await audit({ actorUserId: request.user.id, action: 'ANNOUNCEMENT_UPDATED', entityType: 'announcement', entityId: request.params.id, before: existing.rows[0], after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function auditLogs(request, response) {
	try { const { page, limit, offset } = pageParams(request.query); const [rows, count] = await Promise.all([pool.query(`SELECT a.*,u.name AS "actorName" FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]), pool.query('SELECT count(*)::int AS total FROM audit_logs')]); return paged(response, rows.rows, { page, limit }, count.rows[0].total); } catch (error) { return requestError(error, response); }
}

export async function report(request, response) {
	try {
		const queries = {
			members: `SELECT (SELECT count(*) FROM users) AS "totalUsers",(SELECT count(*) FROM users WHERE account_status='ACTIVE') AS "activeUsers",(SELECT count(*) FROM membership_applications WHERE status='SUBMITTED') AS "pendingApplications"`,
			events: `SELECT (SELECT count(*) FROM events WHERE status='PUBLISHED' AND starts_at >= NOW()) AS "upcomingEvents",(SELECT count(*) FROM event_registrations WHERE status='REGISTERED') AS "registrations"`,
			giving: `SELECT COALESCE((SELECT sum(amount) FROM donations WHERE status='APPROVED'),0) AS "approvedAmount",(SELECT count(*) FROM donations WHERE status='PENDING') AS "pendingDonations",(SELECT count(*) FROM fundraising_campaigns WHERE status='ACTIVE') AS "activeCampaigns"`,
		};
		if (!queries[request.params.type]) return response.status(404).json({ error: 'Unknown report type.' });
		if (request.params.type === 'giving' && !request.user.permissions.includes('finance.manage')) return response.status(403).json({ error: 'Finance permission is required for this report.' });
		const result = await pool.query(queries[request.params.type]);
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function telegramInbox(request, response) {
	try {
		const { page, limit, offset } = pageParams(request.query);
		const canViewSensitive = actorPermissions(request).has('prayer_requests.view');
		const values = [canViewSensitive];
		const conditions = ["m.status NOT IN ('DRAFT','CANCELLED')", '(NOT c.is_sensitive OR $1::boolean)'];
		const addFilter = (value, expression) => {
			if (typeof value !== 'string' || !value.trim()) return;
			values.push(value.trim());
			conditions.push(expression(values.length));
		};
		const statusFilter = request.query.status;
		if (statusFilter && !['NEW','IN_REVIEW','IN_PROGRESS','ASSIGNED','AWAITING_RESPONSE','REPLIED','RESOLVED','CLOSED'].includes(statusFilter)) throw Object.assign(new Error('Select a valid inbox status.'), { status: 400 });
		const priorityFilter = request.query.priority;
		if (priorityFilter && !['LOW','NORMAL','HIGH','URGENT'].includes(priorityFilter)) throw Object.assign(new Error('Select a valid priority.'), { status: 400 });
		const channelFilter = request.query.channel;
		if (channelFilter && !['TELEGRAM','EMAIL','WEBSITE'].includes(channelFilter)) throw Object.assign(new Error('Select a valid submission channel.'), { status: 400 });
		for (const dateValue of [request.query.from, request.query.to]) {
			if (dateValue && !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) throw Object.assign(new Error('Use valid ISO dates for the date filters.'), { status: 400 });
		}
		if (statusFilter === 'IN_REVIEW') conditions.push("m.status IN ('IN_REVIEW','IN_PROGRESS')");
		else addFilter(statusFilter, (index) => `m.status=$${index}`);
		addFilter(request.query.category, (index) => `m.category_code=$${index}`);
		addFilter(request.query.priority, (index) => `m.priority=$${index}`);
		addFilter(request.query.assignedTo, (index) => `m.assigned_to=$${index}`);
		addFilter(request.query.channel, (index) => `m.source_channel=$${index}`);
		addFilter(request.query.from, (index) => `m.received_at >= $${index}::date`);
		addFilter(request.query.to, (index) => `m.received_at < ($${index}::date + INTERVAL '1 day')`);
		addFilter(request.query.search, (index) => `(m.content ILIKE $${index} OR m.reference_code ILIKE $${index} OR (NOT m.is_anonymous AND (ta.display_name ILIKE $${index} OR ta.username ILIKE $${index})))`);
		const where = `WHERE ${conditions.join(' AND ')}`;
		const listValues = [...values, limit, offset];
		const [rows, total, categories, counts, assignees] = await Promise.all([
			pool.query(`SELECT m.id,m.reference_code AS "referenceCode",m.content,m.content_type AS "contentType",
				m.received_at AS "receivedAt",m.status,m.category_code AS "categoryCode",c.label AS category,c.is_sensitive AS "isSensitive",
				m.priority,m.assigned_to AS "assignedTo",assignee.name AS "assignedToName",m.source_channel AS "sourceChannel",
				m.is_anonymous AS "isAnonymous",
				CASE WHEN m.is_anonymous THEN NULL ELSE ta.username END AS "telegramUsername",
				CASE WHEN m.is_anonymous THEN NULL ELSE ta.display_name END AS "telegramDisplayName",
				CASE WHEN m.is_anonymous THEN NULL ELSE u.id END AS "linkedUserId",
				CASE WHEN m.is_anonymous THEN NULL ELSE u.name END AS "linkedUserName",
				CASE WHEN m.is_anonymous THEN NULL ELSE h.name END AS "handledByName",
				COALESCE((SELECT json_agg(json_build_object('id',r.id,'replyText',r.reply_text,'status',r.status,'error',r.error_detail,'sentBy',su.name,'createdAt',r.created_at,'deliveredAt',r.delivered_at) ORDER BY r.created_at) FROM telegram_message_replies r LEFT JOIN users su ON su.id=r.sent_by WHERE r.telegram_message_id=m.id),'[]') AS replies,
				COALESCE((SELECT json_agg(json_build_object('id',n.id,'note',n.note,'createdAt',n.created_at,'createdBy',nu.name) ORDER BY n.created_at) FROM telegram_message_notes n LEFT JOIN users nu ON nu.id=n.created_by WHERE n.telegram_message_id=m.id),'[]') AS notes,
				COALESCE((SELECT json_agg(json_build_object('oldStatus',sh.old_status,'newStatus',sh.new_status,'createdAt',sh.created_at,'changedBy',hu.name) ORDER BY sh.created_at) FROM telegram_message_status_history sh LEFT JOIN users hu ON hu.id=sh.changed_by WHERE sh.telegram_message_id=m.id),'[]') AS "statusHistory"
				FROM telegram_messages m JOIN telegram_inbox_categories c ON c.code=m.category_code
				LEFT JOIN LATERAL (SELECT account.id,account.username,account.display_name,account.user_id FROM telegram_accounts account WHERE account.chat_id=m.chat_id ORDER BY account.updated_at DESC LIMIT 1) ta ON TRUE
				LEFT JOIN users u ON u.id=ta.user_id LEFT JOIN users h ON h.id=m.handled_by
				LEFT JOIN users assignee ON assignee.id=m.assigned_to ${where}
				ORDER BY m.received_at DESC LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`, listValues),
			pool.query(`SELECT count(DISTINCT m.id)::int AS total FROM telegram_messages m JOIN telegram_inbox_categories c ON c.code=m.category_code LEFT JOIN telegram_accounts ta ON ta.chat_id=m.chat_id ${where}`, values),
			pool.query(`SELECT code,label,is_sensitive AS "isSensitive" FROM telegram_inbox_categories ORDER BY sort_order,code`),
			pool.query(`SELECT m.status,count(*)::int AS count FROM telegram_messages m JOIN telegram_inbox_categories c ON c.code=m.category_code
				WHERE m.status NOT IN ('DRAFT','CANCELLED') AND (NOT c.is_sensitive OR $1::boolean) GROUP BY m.status`, [canViewSensitive]),
			pool.query(`SELECT DISTINCT u.id,u.name FROM users u
				JOIN user_roles ur ON ur.user_id=u.id
				JOIN role_permissions rp ON rp.role_id=ur.role_id
				JOIN permissions p ON p.id=rp.permission_id
				WHERE u.account_status='ACTIVE' AND p.code IN ('telegram.manage','prayer_requests.respond')
				ORDER BY u.name`),
		]);
		const totalCount = total.rows[0].total;
		return response.json({ success: true, data: rows.rows, categories: categories.rows, assignees: assignees.rows,
			counts: Object.fromEntries(counts.rows.map((row) => [row.status, row.count])),
			meta: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) } });
	} catch (error) { return requestError(error, response); }
}

async function assertTelegramMessageAccess(request, messageId) {
	const result = await pool.query(`SELECT c.is_sensitive AS "isSensitive" FROM telegram_messages m
		JOIN telegram_inbox_categories c ON c.code=m.category_code WHERE m.id=$1`, [messageId]);
	if (!result.rowCount) throw Object.assign(new Error('Telegram message was not found.'), { status: 404 });
	if (result.rows[0].isSensitive && !actorPermissions(request).has('prayer_requests.view')) {
		throw Object.assign(new Error('Prayer-request permission is required to access this message.'), { status: 403 });
	}
}

export function normalizeTelegramReply(value) {
	if (typeof value !== 'string') throw Object.assign(new Error('Write a message before sending.'), { status: 400 });
	const text = value.trim();
	if (!text) throw Object.assign(new Error('Write a message before sending.'), { status: 400 });
	if (text.length > 4000) throw Object.assign(new Error('Telegram replies must be 4,000 characters or fewer.'), { status: 400 });
	return text;
}

export async function replyToTelegramMessage(request, response) {
	let replyId;
	try {
		const messageId = Number(request.params.id);
		if (!Number.isSafeInteger(messageId) || messageId < 1) throw Object.assign(new Error('Telegram message was not found.'), { status: 404 });
		const replyText = normalizeTelegramReply(request.body?.replyText);
		const idempotencyKey = typeof request.body?.idempotencyKey === 'string' ? request.body.idempotencyKey.trim() : '';
		if (!/^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) throw Object.assign(new Error('A valid reply idempotency key is required.'), { status: 400 });

		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const inboxMessage = await client.query(`SELECT m.id,m.chat_id,m.status,c.is_sensitive AS "isSensitive"
				FROM telegram_messages m JOIN telegram_inbox_categories c ON c.code=m.category_code WHERE m.id=$1 FOR UPDATE OF m`, [messageId]);
			if (!inboxMessage.rowCount) throw Object.assign(new Error('Telegram message was not found.'), { status: 404 });
			if (inboxMessage.rows[0].isSensitive && !actorPermissions(request).has('prayer_requests.respond')) throw Object.assign(new Error('Prayer-request response permission is required.'), { status: 403 });
			if (['CLOSED','RESOLVED'].includes(inboxMessage.rows[0].status)) throw Object.assign(new Error('This conversation is resolved or closed. Reopen it before replying.'), { status: 409 });
			const inserted = await client.query(`INSERT INTO telegram_message_replies(telegram_message_id,idempotency_key,reply_text,sent_by)
				VALUES($1,$2,$3,$4) ON CONFLICT(idempotency_key) DO NOTHING RETURNING id,status`, [messageId,idempotencyKey,replyText,request.user.id]);
			if (!inserted.rowCount) {
				const existing = await client.query(`SELECT id,telegram_message_id AS "messageId",reply_text AS "replyText",status FROM telegram_message_replies WHERE idempotency_key=$1`, [idempotencyKey]);
				if (!existing.rowCount || String(existing.rows[0].messageId) !== String(messageId) || existing.rows[0].replyText !== replyText) throw Object.assign(new Error('This retry key was already used for a different reply.'), { status: 409 });
				if (existing.rows[0].status === 'DELIVERED' || existing.rows[0].status === 'PENDING') {
					await client.query('COMMIT');
					return response.status(existing.rows[0].status === 'PENDING' ? 202 : 200).json({ success:true, data:existing.rows[0], message:existing.rows[0].status === 'PENDING' ? 'This reply is already being delivered.' : 'This reply was already delivered.' });
				}
				const resumed = await client.query(`UPDATE telegram_message_replies SET status='PENDING',error_detail=NULL,sent_by=$2 WHERE id=$1 RETURNING id`, [existing.rows[0].id,request.user.id]);
				replyId = resumed.rows[0].id;
			} else {
				replyId = inserted.rows[0].id;
			}
			const oldStatus = inboxMessage.rows[0].status;
			await client.query(`UPDATE telegram_messages SET status='IN_PROGRESS',handled_by=$2,handled_at=NOW() WHERE id=$1`, [messageId,request.user.id]);
			if (oldStatus !== 'IN_PROGRESS') {
				await client.query(`INSERT INTO telegram_message_status_history(telegram_message_id,old_status,new_status,changed_by)
					VALUES($1,$2,'IN_PROGRESS',$3)`, [messageId,oldStatus,request.user.id]);
			}
			await client.query('COMMIT');
			const chatId = inboxMessage.rows[0].chat_id;
			try {
				const delivery = await sendTelegramNotification({ chatId, text: replyText });
				const result = await pool.query(`UPDATE telegram_message_replies SET status='DELIVERED',telegram_delivery_message_id=$2,delivered_at=NOW() WHERE id=$1 RETURNING id,status,reply_text AS "replyText",created_at AS "createdAt",delivered_at AS "deliveredAt"`, [replyId,delivery.messageId]);
				await pool.query(`UPDATE telegram_messages SET status='REPLIED',handled_by=$2,handled_at=NOW() WHERE id=$1`, [messageId,request.user.id]);
				await pool.query(`INSERT INTO telegram_message_status_history(telegram_message_id,old_status,new_status,changed_by)
					VALUES($1,'IN_PROGRESS','REPLIED',$2)`, [messageId,request.user.id]);
				await audit({ actorUserId:request.user.id,action:'TELEGRAM_INBOX_REPLIED',entityType:'telegram_message',entityId:messageId,after:{replyId:result.rows[0].id,status:'DELIVERED',replyText},ipAddress:clientIp(request) });
				return response.status(201).json({ success:true,data:result.rows[0] });
			} catch (error) {
				const reason=String(error.message||'Telegram delivery failed.').slice(0,1000);
				await pool.query(`UPDATE telegram_message_replies SET status='FAILED',error_detail=$2 WHERE id=$1`,[replyId,reason]);
				await audit({actorUserId:request.user.id,action:'TELEGRAM_INBOX_REPLY_FAILED',entityType:'telegram_message',entityId:messageId,after:{replyId,status:'FAILED'},ipAddress:clientIp(request)});
				return response.status(502).json({error:'Telegram could not deliver the reply. Your draft is preserved in the conversation; retry with a new send attempt.'});
			}
		} catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
	} catch (error) { return requestError(error,response); }
}

export async function updateTelegramMessage(request, response) {
	try {
		const status = request.body?.status;
		const allowedStatuses = ['NEW','IN_REVIEW','IN_PROGRESS','ASSIGNED','AWAITING_RESPONSE','REPLIED','RESOLVED','CLOSED'];
		if (status !== undefined && !allowedStatuses.includes(status)) throw Object.assign(new Error('Invalid message status.'), { status: 400 });
		const messageId = Number(request.params.id);
		if (!Number.isSafeInteger(messageId) || messageId < 1) throw Object.assign(new Error('Telegram message was not found.'), { status: 404 });
		await assertTelegramMessageAccess(request, messageId);
		const categoryCode = request.body?.categoryCode;
		const priority = request.body?.priority;
		const assignedTo = request.body?.assignedTo;
		if (priority !== undefined && !['LOW','NORMAL','HIGH','URGENT'].includes(priority)) throw Object.assign(new Error('Invalid message priority.'), { status: 400 });
		if (categoryCode !== undefined) {
			const category = await pool.query('SELECT code,is_sensitive AS "isSensitive" FROM telegram_inbox_categories WHERE code=$1', [categoryCode]);
			if (!category.rowCount) throw Object.assign(new Error('Select a valid message category.'), { status: 400 });
			if (category.rows[0].isSensitive && !actorPermissions(request).has('prayer_requests.respond')) throw Object.assign(new Error('Prayer-request permission is required to manage this category.'), { status: 403 });
		}
		if (assignedTo !== undefined && assignedTo !== null) {
			const staff = await pool.query(`SELECT DISTINCT u.id FROM users u
				JOIN user_roles ur ON ur.user_id=u.id
				JOIN role_permissions rp ON rp.role_id=ur.role_id
				JOIN permissions p ON p.id=rp.permission_id
				WHERE u.id=$1 AND u.account_status='ACTIVE'
				AND p.code IN ('telegram.manage','prayer_requests.respond')`, [assignedTo]);
			if (!staff.rowCount) throw Object.assign(new Error('Select an active Telegram or prayer-request staff member.'), { status: 400 });
		}
		const previous = await pool.query('SELECT status FROM telegram_messages WHERE id=$1', [messageId]);
		if (!previous.rowCount) throw Object.assign(new Error('Telegram message was not found.'), { status: 404 });
		const result = await pool.query(`UPDATE telegram_messages SET
			status=COALESCE($2,status),category_code=COALESCE($3,category_code),priority=COALESCE($4,priority),
			assigned_to=CASE WHEN $5::boolean THEN $6::bigint ELSE assigned_to END,
			handled_by=CASE WHEN $2 IS NOT NULL THEN $7 ELSE handled_by END,
			handled_at=CASE WHEN $2 IS NOT NULL THEN NOW() ELSE handled_at END
			WHERE id=$1 RETURNING id,status,category_code AS "categoryCode",priority,assigned_to AS "assignedTo"`,
		[messageId,status ?? null,categoryCode ?? null,priority ?? null,assignedTo !== undefined,assignedTo ?? null,request.user.id]);
		if (!result.rowCount) return response.status(404).json({ error: 'Telegram message not found.' });
		if (status && status !== previous.rows[0].status) await pool.query(`INSERT INTO telegram_message_status_history(telegram_message_id,old_status,new_status,changed_by) VALUES($1,$2,$3,$4)`, [messageId,previous.rows[0].status,status,request.user.id]);
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_MESSAGE_UPDATED', entityType: 'telegram_message', entityId: messageId, after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function addTelegramMessageNote(request, response) {
	try {
		const messageId = Number(request.params.id);
		if (!Number.isSafeInteger(messageId) || messageId < 1) throw Object.assign(new Error('Telegram message was not found.'), { status: 404 });
		await assertTelegramMessageAccess(request, messageId);
		const rawNote = request.body?.note;
		if (typeof rawNote !== 'string' || !rawNote.trim()) throw Object.assign(new Error('Write a private note before saving.'), { status: 400 });
		const note = rawNote.trim();
		if (note.length > 4000) throw Object.assign(new Error('Private notes must be 4,000 characters or fewer.'), { status: 400 });
		const result = await pool.query(`INSERT INTO telegram_message_notes(telegram_message_id,note,created_by)
			VALUES($1,$2,$3) RETURNING id,note,created_at AS "createdAt"`, [messageId,note,request.user.id]);
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_MESSAGE_INTERNAL_NOTE_ADDED', entityType: 'telegram_message', entityId: messageId, after: { noteId: result.rows[0].id }, ipAddress: clientIp(request) });
		return response.status(201).json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

function notificationFail(message, status = 400) {
return Object.assign(new Error(message), { status });
}

const PROTECTED_ROLE_CODES = new Set(['SYSTEM_OWNER', 'ADMIN']);
const PRIVILEGED_CODES = new Set(['SYSTEM_OWNER', 'ADMIN']);

function actorPermissions(request) {
return new Set(Array.isArray(request.user?.permissions) ? request.user.permissions : []);
}

function actorIsSystemOwner(request) {
return Array.isArray(request.user?.roles) && request.user.roles.some((role) => String(role).toUpperCase() === SYSTEM_OWNER);
}

export async function listPermissions(_request, response) {
try {
const result = await pool.query(`SELECT id,code,description FROM permissions ORDER BY code`);
return response.json({ success: true, data: result.rows });
} catch (error) { return requestError(error, response); }
}

export async function createRole(request, response) {
const client = await pool.connect();
try {
const { code, name, description, permissionCodes = [] } = request.body ?? {};
if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{2,79}$/.test(code.trim())) {
throw notificationFail('Role code must start with a letter and contain only uppercase letters, numbers, and underscores.', 400);
}
const roleCode = code.trim();
if (PROTECTED_ROLE_CODES.has(roleCode)) {
throw notificationFail('The SYSTEM_OWNER and ADMIN roles are protected and cannot be created here.', 403);
}
if (!Array.isArray(permissionCodes) || permissionCodes.some((c) => typeof c !== 'string')) {
throw notificationFail('permissionCodes must be a list of permission codes.', 400);
}
const actor = actorPermissions(request);
const actorOwner = actorIsSystemOwner(request);
for (const permission of permissionCodes) {
if (!actor.has(permission) && !actorOwner) {
throw notificationFail(`You are not authorized to grant the "${permission}" permission.`, 403);
}
}
await client.query('BEGIN');
const existing = await client.query('SELECT id FROM roles WHERE code=$1', [roleCode]);
if (existing.rowCount) throw notificationFail('A role with this code already exists.', 409);
const result = await client.query(`INSERT INTO roles(code,name,description,is_system) VALUES($1,$2,$3,FALSE) RETURNING id,code,name,description,is_system`,
[roleCode, typeof name === 'string' ? name.trim() : null, typeof description === 'string' ? description.trim() : null]);
const roleId = result.rows[0].id;
if (permissionCodes.length) {
const perms = await client.query('SELECT id FROM permissions WHERE code = ANY($1::varchar[])', [permissionCodes]);
if (perms.rowCount !== permissionCodes.length) throw notificationFail('One or more permission codes do not exist.', 400);
await client.query(`INSERT INTO role_permissions(role_id,permission_id) SELECT $1, id FROM permissions WHERE code = ANY($2::varchar[])`, [roleId, permissionCodes]);
}
await audit({ actorUserId: request.user.id, action: 'ROLE_CREATED', entityType: 'role', entityId: String(roleId), after: { code: roleCode, name: result.rows[0].name, permissionCodes }, ipAddress: clientIp(request) });
await client.query('COMMIT');
return response.status(201).json({ success: true, data: result.rows[0] });
} catch (error) { await client.query('ROLLBACK').catch(() => {}); return requestError(error, response); } finally { client.release(); }
}

export async function updateRole(request, response) {
const client = await pool.connect();
try {
const roleId = Number(request.params.id);
if (!Number.isSafeInteger(roleId) || roleId < 1) throw notificationFail('Invalid role.', 404);
const { name, description } = request.body ?? {};
const actorOwner = actorIsSystemOwner(request);
await client.query('BEGIN');
const existing = await client.query('SELECT id,code,name,description,is_system FROM roles WHERE id=$1 FOR UPDATE', [roleId]);
if (!existing.rowCount) throw notificationFail('Role not found.', 404);
const role = existing.rows[0];
if (role.is_system && !actorOwner) throw notificationFail('System roles cannot be edited.', 403);
const updates = [];
const values = [];
if (typeof name === 'string') { updates.push(`name=$${updates.length + 1}`); values.push(name.trim()); }
if (typeof description === 'string') { updates.push(`description=$${updates.length + 1}`); values.push(description.trim()); }
if (updates.length === 0) { await client.query('COMMIT'); return response.json({ success: true, data: role }); }
values.push(roleId);
const result = await client.query(`UPDATE roles SET ${updates.join(', ')} WHERE id=$${updates.length + 1} RETURNING id,code,name,description,is_system`, values);
await audit({ actorUserId: request.user.id, action: 'ROLE_UPDATED', entityType: 'role', entityId: String(roleId), before: { name: role.name, description: role.description }, after: { name: result.rows[0].name, description: result.rows[0].description }, ipAddress: clientIp(request) });
await client.query('COMMIT');
return response.json({ success: true, data: result.rows[0] });
} catch (error) { await client.query('ROLLBACK').catch(() => {}); return requestError(error, response); } finally { client.release(); }
}

export async function setRolePermissions(request, response) {
const client = await pool.connect();
try {
const roleId = Number(request.params.id);
if (!Number.isSafeInteger(roleId) || roleId < 1) throw notificationFail('Invalid role.', 404);
const { permissionCodes = [] } = request.body ?? {};
if (!Array.isArray(permissionCodes) || permissionCodes.some((c) => typeof c !== 'string')) {
throw notificationFail('permissionCodes must be a list of permission codes.', 400);
}
const actor = actorPermissions(request);
const actorOwner = actorIsSystemOwner(request);
await client.query('BEGIN');
const existing = await client.query('SELECT id,code,is_system FROM roles WHERE id=$1 FOR UPDATE', [roleId]);
if (!existing.rowCount) throw notificationFail('Role not found.', 404);
const role = existing.rows[0];
if (role.is_system && !actorOwner) throw notificationFail('System role permissions cannot be changed.', 403);
if (PROTECTED_ROLE_CODES.has(role.code) && !actorOwner) throw notificationFail('Only a system owner can change administrator or system-owner capabilities.', 403);
const granted = [...new Set(permissionCodes)];
for (const permission of granted) {
if (!actor.has(permission) && !actorOwner) throw notificationFail(`You are not authorized to grant the "${permission}" permission.`, 403);
}
if (granted.includes('system.owner.manage') && !actorOwner) throw notificationFail('Only a system owner can manage system-owner authority.', 403);
const perms = await client.query('SELECT id,code FROM permissions WHERE code = ANY($1::varchar[])', [granted]);
if (perms.rowCount !== granted.length) throw notificationFail('One or more permission codes do not exist.', 400);
await client.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
if (perms.rowCount) {
await client.query(`INSERT INTO role_permissions(role_id,permission_id) SELECT $1,id FROM permissions WHERE id = ANY($2::bigint[])`, [roleId, perms.rows.map((row) => row.id)]);
}
await audit({ actorUserId: request.user.id, action: 'ROLE_PERMISSIONS_UPDATED', entityType: 'role', entityId: String(roleId), after: { code: role.code, permissionCodes: granted }, ipAddress: clientIp(request) });
await client.query('COMMIT');
return response.json({ success: true, data: { id: roleId, code: role.code, permissionCodes: granted } });
} catch (error) { await client.query('ROLLBACK').catch(() => {}); return requestError(error, response); } finally { client.release(); }
}

export async function deleteRole(request, response) {
const client = await pool.connect();
try {
const roleId = Number(request.params.id);
if (!Number.isSafeInteger(roleId) || roleId < 1) throw notificationFail('Invalid role.', 404);
const actorOwner = actorIsSystemOwner(request);
await client.query('BEGIN');
const existing = await client.query('SELECT id,code,is_system FROM roles WHERE id=$1 FOR UPDATE', [roleId]);
if (!existing.rowCount) throw notificationFail('Role not found.', 404);
const role = existing.rows[0];
if (role.is_system) throw notificationFail('System roles cannot be deleted.', 403);
const holders = await client.query(`SELECT u.id,u.name,u.account_status FROM users u
JOIN user_roles ur ON ur.user_id=u.id WHERE ur.role_id=$1`, [roleId]);
const activeHolders = holders.rows.filter((u) => u.account_status === 'ACTIVE');
if (activeHolders.length === 1 && PRIVILEGED_CODES.has(role.code)) {
throw notificationFail(`This is the last active ${role.code} assignment and cannot be removed.`, 409);
}
await client.query('DELETE FROM role_permissions WHERE role_id=$1', [roleId]);
await client.query('DELETE FROM user_roles WHERE role_id=$1', [roleId]);
await client.query('DELETE FROM roles WHERE id=$1', [roleId]);
await audit({ actorUserId: request.user.id, action: 'ROLE_DELETED', entityType: 'role', entityId: String(roleId), after: { code: role.code }, ipAddress: clientIp(request) });
await client.query('COMMIT');
return response.json({ success: true, data: { id: roleId, code: role.code } });
} catch (error) { await client.query('ROLLBACK').catch(() => {}); return requestError(error, response); } finally { client.release(); }
}

async function resolveNotificationAudience(client, audience) {
if (!audience || typeof audience !== 'object') throw notificationFail('audience is required.', 400);
const type = typeof audience.type === 'string' ? audience.type.trim().toUpperCase() : '';
const ref = audience.ref;
const validTypes = ['USER', 'USERS', 'DEPARTMENT', 'ORGANIZATION', 'BIBLE_STUDY_GROUP', 'ROLE', 'ALL'];
if (!validTypes.includes(type)) throw notificationFail('audience.type must be one of: USER, USERS, DEPARTMENT, ORGANIZATION, BIBLE_STUDY_GROUP, ROLE, ALL.', 400);
let ids = [];
if (type === 'ALL') {
const result = await client.query('SELECT id FROM users WHERE account_status=\'ACTIVE\'');
ids = result.rows.map((row) => row.id);
} else if (type === 'USER') {
if (!/^\d+$/.test(String(ref)) || Number(ref) < 1) throw notificationFail('audience.ref must be a positive user id for USER.', 400);
ids = [Number(ref)];
} else if (type === 'USERS') {
if (!Array.isArray(ref) || ref.length === 0 || ref.length > 5000 || ref.some((id) => !/^\d+$/.test(String(id)) || Number(id) < 1)) {
throw notificationFail('audience.ref must contain 1 to 5000 positive user ids for USERS.', 400);
}
ids = [...new Set(ref.map(Number))];
} else if (type === 'DEPARTMENT') {
if (!/^\d+$/.test(String(ref)) || Number(ref) < 1) throw notificationFail('audience.ref must be a positive department id for DEPARTMENT.', 400);
const result = await client.query(`SELECT dm.user_id FROM department_members dm
JOIN departments d ON d.id=dm.department_id WHERE dm.department_id=$1 AND dm.status='ACTIVE' AND d.deleted_at IS NULL`, [Number(ref)]);
ids = result.rows.map((row) => row.user_id);
} else if (type === 'ORGANIZATION') {
if (!/^\d+$/.test(String(ref)) || Number(ref) < 1) throw notificationFail('audience.ref must be a positive organization id for ORGANIZATION.', 400);
const result = await client.query(`SELECT DISTINCT dm.user_id FROM department_members dm
JOIN departments d ON d.id=dm.department_id
JOIN organizations o ON o.id=d.organization_id
WHERE o.id=$1 AND dm.status='ACTIVE' AND o.deleted_at IS NULL AND d.deleted_at IS NULL`, [Number(ref)]);
ids = result.rows.map((row) => row.user_id);
} else if (type === 'BIBLE_STUDY_GROUP') {
if (!/^\d+$/.test(String(ref)) || Number(ref) < 1) throw notificationFail('audience.ref must be a positive Bible study group id.', 400);
const result = await client.query(`SELECT bsm.user_id FROM bible_study_memberships bsm
JOIN bible_study_groups g ON g.id=bsm.bible_study_group_id
WHERE g.id=$1 AND bsm.status='ACTIVE' AND g.deleted_at IS NULL`, [Number(ref)]);
ids = result.rows.map((row) => row.user_id);
} else if (type === 'ROLE') {
if (typeof ref !== 'string' || !ref.trim()) throw notificationFail('audience.ref must be a role code for ROLE.', 400);
const result = await client.query(`SELECT ur.user_id FROM user_roles ur
JOIN roles r ON r.id=ur.role_id WHERE r.code=$1`, [ref.trim().toUpperCase()]);
ids = result.rows.map((row) => row.user_id);
}
const unique = [...new Set(ids)];
if (unique.length === 0) throw notificationFail('No recipients matched the selected audience.', 404);
const active = await client.query(`SELECT id FROM users WHERE account_status='ACTIVE' AND id = ANY($1::bigint[])`, [unique]);
if (!active.rowCount) throw notificationFail('No active recipients matched the selected audience.', 404);
return active.rows.map((row) => row.id);
}

export async function listWebsiteNotifications(request, response) {
try {
const { page, limit, offset } = pageParams(request.query);
const result = await pool.query(`SELECT n.id,n.title,n.body,n.image_url AS "imageUrl",n.link_url AS "linkUrl",n.notification_status AS "status",
n.created_at AS "createdAt",u.name AS "recipientName",u.email AS "recipientEmail"
FROM user_notifications n LEFT JOIN users u ON u.id=n.user_id
WHERE n.type='WEBSITE' AND n.notification_status <> 'SKIPPED'
ORDER BY n.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
return response.json({ success: true, data: result.rows });
} catch (error) { return requestError(error, response); }
}

export async function createWebsiteNotification(request, response) {
const client = await pool.connect();
try {
const { title, body, linkUrl, imageUrl, audience } = request.body ?? {};
if (typeof title !== 'string' || !title.trim()) throw notificationFail('Title is required.', 400);
if (typeof body !== 'string' || !body.trim()) throw notificationFail('Body is required.', 400);
const recipientIds = await resolveNotificationAudience(client, audience);
const cleanTitle = title.trim().slice(0, 200);
const cleanBody = body.trim().slice(0, 10000);
let cleanLink = typeof linkUrl === 'string' && linkUrl.trim() ? linkUrl.trim() : null;
if (cleanLink && !(cleanLink.startsWith('/') && !cleanLink.startsWith('//') && !cleanLink.includes('\\'))) {
    try {
      const parsed = new URL(cleanLink);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error();
      cleanLink = parsed.href;
    } catch {
      throw notificationFail('Link must be a member-side path or a valid HTTPS URL.', 400);
    }
}
const cleanImage = typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null;
if (cleanImage) {
  try { if (new URL(cleanImage).protocol !== 'https:') throw new Error(); }
  catch { throw notificationFail('Image URL must be a valid HTTPS URL.', 400); }
}
await client.query('BEGIN');
const audienceRef = typeof audience?.ref === 'string' ? audience.ref : (Array.isArray(audience?.ref) ? audience.ref.join(',') : null);
const batch = await client.query(`INSERT INTO notification_batches(actor_user_id,mode,title,subject,body,link_url,audience_type,audience_ref,channels,recipient_count,in_app_count,status,idempotency_key)
VALUES($1,'LIVE',$2,$2,$3,$4,$5,$6,'{}',$7,$7,'COMPLETED',gen_random_uuid()) RETURNING id`,
[request.user.id, cleanTitle, cleanBody, cleanLink, audience.type, audienceRef, recipientIds.length]);
const batchId = batch.rows[0].id;
	const values = [];
	const params = [];
	let paramIndex = 1;
	for (const userId of recipientIds) {
		values.push(`($${paramIndex},'WEBSITE',$${paramIndex + 1},$${paramIndex + 2},$${paramIndex + 3},$${paramIndex + 4},$${paramIndex + 5})`);
		params.push(userId, cleanTitle, cleanBody, cleanImage, cleanLink, 'PENDING');
		paramIndex += 6;
	}
	if (values.length) await client.query(`INSERT INTO user_notifications(user_id,type,title,body,image_url,link_url,notification_status) VALUES ${values.join(',')}`, params);
await audit({ actorUserId: request.user.id, action: 'WEBSITE_NOTIFICATION_SENT', entityType: 'notification_batch', entityId: String(batchId), after: { recipientCount: recipientIds.length, title: cleanTitle, audienceType: audience.type }, ipAddress: clientIp(request) });
await client.query('COMMIT');
return response.status(201).json({ success: true, data: { id: batchId, recipientCount: recipientIds.length } });
} catch (error) { await client.query('ROLLBACK').catch(() => {}); return requestError(error, response); } finally { client.release(); }
}

export async function archiveWebsiteNotification(request, response) {
try {
const notificationId = Number(request.params.id);
if (!Number.isSafeInteger(notificationId) || notificationId < 1) throw notificationFail('Invalid notification.', 404);
const result = await pool.query(`UPDATE user_notifications SET notification_status='SKIPPED',updated_at=NOW()
WHERE id=$1 AND type='WEBSITE' RETURNING id`, [notificationId]);
if (!result.rowCount) return response.status(404).json({ error: 'Notification not found.' });
await audit({ actorUserId: request.user.id, action: 'WEBSITE_NOTIFICATION_ARCHIVED', entityType: 'user_notification', entityId: String(notificationId), ipAddress: clientIp(request) });
return response.json({ success: true, data: result.rows[0] });
} catch (error) { return requestError(error, response); }
}

export async function testCommunication(request, response) {
try {
const { channel, userId, subject, body, imageUrl, audience, confirmGroupSend } = request.body ?? {};
if (!['email', 'telegram', 'website'].includes(channel)) throw notificationFail('channel must be email, telegram, or website.', 400);
const client = await pool.connect();
let recipientIds;
try {
  recipientIds = audience ? await resolveNotificationAudience(client, audience) : await resolveNotificationAudience(client, { type: 'USER', ref: userId });
  if (recipientIds.length > 10 && confirmGroupSend !== true) {
    throw notificationFail(`This will send a real test message to ${recipientIds.length} people. Confirm the group send before continuing.`, 409);
  }
} finally { client.release(); }
const target = await pool.query('SELECT id,name,email,telegram_chat_id AS "telegramChatId" FROM users WHERE id = ANY($1::bigint[]) AND account_status=\'ACTIVE\' ORDER BY id', [recipientIds]);
if (!target.rowCount) throw notificationFail('No active recipients were found.', 404);
const cleanSubject = typeof subject === 'string' && subject.trim() ? subject.trim().slice(0, 200) : 'Test message';
const cleanBody = typeof body === 'string' && body.trim() ? body.trim().slice(0, 4000) : 'This is a test message from the church communications panel.';
const testLabel = `[TEST — please ignore] ${cleanBody}`;
let safeImage = null;
if (typeof imageUrl === 'string' && imageUrl.trim()) {
  try { if (new URL(imageUrl.trim()).protocol !== 'https:') throw new Error(); safeImage = imageUrl.trim(); }
  catch { throw notificationFail('Image URL must be a valid HTTPS URL.', 400); }
}
const deliveries = await Promise.all(target.rows.map(async (user) => {
  try {
    if (channel === 'email') {
      if (!user.email) return { recipientId: user.id, name: user.name, status: 'SKIPPED', detail: 'No email address.' };
      const sent = await sendEmailNotification({ to: user.email, subject: `[TEST] ${cleanSubject}`, text: testLabel,
        html: renderEmailHtml({ greeting: `Hello ${user.name}`, subject: `[TEST] ${cleanSubject}`, body: testLabel, bannerUrl: safeImage }) });
      return { recipientId: user.id, name: user.name, status: 'DELIVERED', messageId: sent?.messageId ?? null };
    }
    if (channel === 'telegram') {
      if (!user.telegramChatId) return { recipientId: user.id, name: user.name, status: 'SKIPPED', detail: 'No linked Telegram chat.' };
      const sent = await sendTelegramNotification({ chatId: user.telegramChatId, text: `[TEST] ${cleanSubject}\n\n${testLabel}`, photoUrl: safeImage });
      return { recipientId: user.id, name: user.name, status: 'DELIVERED', messageId: sent?.messageId ?? null };
    }
    await pool.query(`INSERT INTO user_notifications(user_id,type,title,body,image_url,link_url,email_status)
      VALUES($1,'WEBSITE_TEST',$2,$3,$4,NULL,'PENDING')`, [user.id, `[TEST] ${cleanSubject}`, testLabel, safeImage]);
    return { recipientId: user.id, name: user.name, status: 'DELIVERED' };
  } catch (error) { return { recipientId: user.id, name: user.name, status: 'FAILED', detail: String(error.message || error).slice(0, 1000) }; }
}));
const counts = deliveries.reduce((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }), {});
const integration = { status: counts.FAILED ? (counts.DELIVERED ? 'PARTIAL' : 'FAILED') : (counts.DELIVERED ? 'DELIVERED' : 'SKIPPED'),
  detail: `${counts.DELIVERED || 0} delivered, ${counts.FAILED || 0} failed, ${counts.SKIPPED || 0} skipped.` };
await audit({ actorUserId: request.user.id, action: 'COMMUNICATION_TEST', entityType: 'communication_group', entityId: String(target.rows[0].id), after: { channel, recipientCount: target.rows.length, integrationStatus: integration.status }, ipAddress: clientIp(request) });
return response.json({ success: true, data: { channel, recipient: target.rows.length === 1 ? target.rows[0] : null, recipientCount: target.rows.length, deliveries, integration } });
} catch (error) { return requestError(error, response); }
}
