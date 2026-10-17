import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { createHash, randomBytes } from 'node:crypto';
import { churchDate, publishAutomaticDailyVerse } from '../services/dailyVerseService.js';
import { sendEmailNotification } from '../services/emailService.js';
import { createNewChristianWelcomeEmail } from '../services/welcomeEmailTemplate.js';
import { pageParams, paged, requestError } from '../utils/http.js';
import { requiredString } from '../utils/http.js';
import { normalizePaymentMethods } from '../services/paymentMethods.js';

const VALID_NEW_CHRISTIAN_CONTACT_METHODS = new Set(['phone', 'email', 'telegram', 'whatsapp']);
const VALID_NEW_CHRISTIAN_LANGUAGES = new Set(['en', 'am', 'om', 'ti']);

export function getNewChristianStatusLabel(status) {
	const normalized = String(status ?? '').toUpperCase();
	const labels = {
		NEW_BELIEVER: 'New believer',
		NEWCOMER: 'Newcomer',
		FOLLOW_UP: 'Follow-up in progress',
		TEACHING: 'Teaching',
		BAPTISM_PREPARATION: 'Baptism preparation',
		BAPTIZED: 'Baptized',
		ACTIVE_MEMBER: 'Active member',
	};
	return labels[normalized] ?? 'New Christian';
}

function normalizePhone(value) {
	const raw = typeof value === 'string' ? value.trim() : '';
	if (!raw) throw Object.assign(new Error('Phone number is required.'), { status: 400 });
	const cleaned = raw.replace(/[\s()-]/g, '');
	if (/^0[79]\d{8}$/.test(cleaned)) return `+251${cleaned.slice(1)}`;
	if (/^\+?[1-9]\d{7,14}$/.test(cleaned)) return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
	throw Object.assign(new Error('Enter a valid phone number in international format, for example +251912345678.'), { status: 400 });
}

export function normalizeNewChristianSubmission(body = {}) {
	const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
	if (!fullName || fullName.length < 2 || fullName.length > 160) {
		throw Object.assign(new Error('Enter a valid full name.'), { status: 400 });
	}

	const phone = normalizePhone(body.phone);
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw Object.assign(new Error('Enter a valid email address when provided.'), { status: 400 });
	}

	const location = typeof body.location === 'string' ? body.location.trim() : '';
	if (!location || location.length > 160) {
		throw Object.assign(new Error('Please provide your neighborhood or location.'), { status: 400 });
	}

	const contactMethod = String(body.preferredContactMethod ?? 'phone').toLowerCase();
	if (!VALID_NEW_CHRISTIAN_CONTACT_METHODS.has(contactMethod)) {
		throw Object.assign(new Error('Select a valid preferred contact method.'), { status: 400 });
	}
	if (contactMethod === 'email' && !email) {
		throw Object.assign(new Error('Provide an email address to use email as your preferred contact method.'), { status: 400 });
	}

	const preferredLanguage = String(body.preferredLanguage ?? 'en').toLowerCase();
	if (!VALID_NEW_CHRISTIAN_LANGUAGES.has(preferredLanguage)) {
		throw Object.assign(new Error('Select a supported preferred language.'), { status: 400 });
	}

	const acceptedJesusInput = body.acceptedJesus;
	if (![true, false, 'yes', 'YES', 'Yes', 'not-yet', 'NOT_YET', 'Not yet'].includes(acceptedJesusInput)) {
		throw Object.assign(new Error('Please confirm whether you have accepted Jesus Christ as your personal Lord and Savior.'), { status: 400 });
	}
	const acceptedJesus = acceptedJesusInput === true || ['yes', 'YES', 'Yes'].includes(acceptedJesusInput);

	const consentToContact = body.consentToContact === true;
	if (!consentToContact) {
		throw Object.assign(new Error('Please give consent for the church to contact you for spiritual guidance and follow-up.'), { status: 400 });
	}

	const prayerRequest = typeof body.prayerRequest === 'string' ? body.prayerRequest.trim().slice(0, 2000) : '';
	return {
		fullName,
		phone,
		email: email || null,
		location,
		preferredContactMethod: contactMethod,
		preferredLanguage,
		acceptedJesus,
		consentToContact,
		prayerRequest: prayerRequest || null,
		status: acceptedJesus ? 'NEW_BELIEVER' : 'NEWCOMER',
	};
}

export async function listEvents(request, response) {
	try {
		const { page, limit, offset } = pageParams(request.query);
		const events = await pool.query(`
			SELECT e.id::text AS id, e.title, e.description, e.starts_at AS "startAt", e.ends_at AS "endAt",
				e.status, e.image_url AS "imageUrl", e.category,
				e.requires_registration AS "requiresRegistration", 'EVENT' AS "programType",
				COALESCE(l.name, e.location_text) AS location
			FROM events e LEFT JOIN program_locations l ON l.id=e.location_id
			WHERE e.status IN ('PUBLISHED','POSTPONED','CANCELLED') AND e.deleted_at IS NULL
			ORDER BY e.starts_at ASC
		`);
		const schedules = await pool.query(`
			WITH RECURSIVE occurrences AS (
				SELECT s.id AS schedule_id, p.id AS program_id, p.name, p.description, p.category AS program_category,
					COALESCE(s.image_url, p.image_url) AS image_url, s.status AS schedule_status,
					s.weekday, s.start_time, s.end_time, s.timezone,
					COALESCE(l.name, s.location_text, '') AS location,
					((NOW() AT TIME ZONE s.timezone)::date + ((s.weekday - EXTRACT(DOW FROM NOW() AT TIME ZONE s.timezone)::int + 7) % 7)) AS occurrence_date,
					(((NOW() AT TIME ZONE s.timezone)::date + ((s.weekday - EXTRACT(DOW FROM NOW() AT TIME ZONE s.timezone)::int + 7) % 7))::timestamp + s.start_time) AT TIME ZONE s.timezone AS occurrence_start,
					(((NOW() AT TIME ZONE s.timezone)::date + ((s.weekday - EXTRACT(DOW FROM NOW() AT TIME ZONE s.timezone)::int + 7) % 7))::timestamp + s.end_time + CASE WHEN s.end_time <= s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END) AT TIME ZONE s.timezone AS occurrence_end
				FROM program_schedules s
				JOIN programs p ON p.id=s.program_id AND p.is_active=TRUE AND p.deleted_at IS NULL
				LEFT JOIN program_locations l ON l.id=s.location_id
				WHERE s.status IN ('ACTIVE','SCHEDULED') AND s.weekday BETWEEN 0 AND 6 AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL
				UNION ALL
				SELECT schedule_id, program_id, name, description, program_category, image_url, schedule_status,
					weekday, start_time, end_time, timezone, location, occurrence_date + 7,
					((occurrence_date + 7)::timestamp + start_time) AT TIME ZONE timezone,
					((occurrence_date + 7)::timestamp + end_time + CASE WHEN end_time <= start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END) AT TIME ZONE timezone
				FROM occurrences WHERE occurrence_date < CURRENT_DATE + INTERVAL '90 days'
			), eligible AS (
				SELECT o.*, COALESCE(x.status, 'SCHEDULED') AS override_status,
					COALESCE(x.starts_at, o.occurrence_start) AS final_start,
					COALESCE(x.ends_at, o.occurrence_end) AS final_end,
					COALESCE(x.location_text, o.location) AS final_location
				FROM occurrences o
				LEFT JOIN program_schedule_overrides x ON x.schedule_id=o.schedule_id AND x.occurrence_date=o.occurrence_date
				WHERE (x.status IS NULL OR x.status <> 'CANCELLED')
					AND NOT EXISTS (
						SELECT 1 FROM events promoted
						WHERE promoted.program_id=o.program_id AND promoted.deleted_at IS NULL
						AND (promoted.starts_at AT TIME ZONE o.timezone)::date=o.occurrence_date
					)
			)
			SELECT CONCAT('program-', schedule_id, '-', occurrence_date::text) AS id,
				name AS title, description, final_start AS "startAt", final_end AS "endAt",
				CASE WHEN override_status='POSTPONED' THEN 'POSTPONED' ELSE 'PUBLISHED' END AS status,
				image_url AS "imageUrl", COALESCE(program_category, 'Regular Program') AS category,
				FALSE AS "requiresRegistration", 'RECURRING' AS "programType", final_location AS location
			FROM eligible
			WHERE final_end > NOW()
			ORDER BY final_start ASC
		`);

		const all = [...events.rows.map((event) => ({ ...event, timezone: config.churchTimezone })), ...schedules.rows]
			.filter((event) => request.query.upcoming !== 'true' || (
				event.status !== 'CANCELLED'
				&& new Date(event.endAt ?? (new Date(event.startAt).getTime() + 2 * 60 * 60 * 1000)).getTime() > Date.now()
			))
			.sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
		const visible = all.slice(offset, offset + limit);
		return paged(response, visible, { page, limit }, all.length);
	} catch (error) { return requestError(error, response); }
}

export async function nextGathering(_request, response) {
	try {
		const result = await listEvents({ query: { upcoming: 'true', page: '1', limit: '1' } }, {
			json(body) { this.body = body; return this; },
			status(code) { this.statusCode = code; return this; },
		});
		if (result?.statusCode >= 400) return response.status(result.statusCode).json(result.body);
		const gathering = result?.body?.data?.[0] ?? null;
		return response.json({ success: true, data: gathering, timezone: config.churchTimezone });
	} catch (error) { return requestError(error, response); }
}

export async function getEvent(request, response) {
	try {
		const recurringMatch = /^program-(\d+)-(\d{4}-\d{2}-\d{2})$/.exec(request.params.id);
		if (recurringMatch) {
			const [, scheduleId, occurrenceDate] = recurringMatch;
			const recurring = await pool.query(`
				SELECT CONCAT('program-', s.id, '-', $2::date::text) AS id, p.name AS title, p.description,
					COALESCE(x.starts_at, (($2::date::timestamp + s.start_time) AT TIME ZONE s.timezone)) AS "startAt",
					COALESCE(x.ends_at, (($2::date::timestamp + s.end_time + CASE WHEN s.end_time <= s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END) AT TIME ZONE s.timezone)) AS "endAt",
					CASE WHEN x.status='POSTPONED' THEN 'POSTPONED' ELSE 'PUBLISHED' END AS status,
					COALESCE(s.image_url, p.image_url) AS "imageUrl", p.category,
					FALSE AS "requiresRegistration", 'RECURRING' AS "programType", s.timezone,
					COALESCE(x.location_text, l.name, '') AS location
				FROM program_schedules s JOIN programs p ON p.id=s.program_id
				LEFT JOIN program_locations l ON l.id=s.location_id
				LEFT JOIN program_schedule_overrides x ON x.schedule_id=s.id AND x.occurrence_date=$2::date
				WHERE s.id=$1 AND p.is_active=TRUE AND p.deleted_at IS NULL
					AND s.status IN ('ACTIVE','SCHEDULED') AND s.weekday=EXTRACT(DOW FROM $2::date)::int
					AND (x.status IS NULL OR x.status <> 'CANCELLED')
			`, [scheduleId, occurrenceDate]);
			if (!recurring.rowCount) return response.status(404).json({ error: 'Program occurrence was not found.' });
			return response.json({ success: true, data: recurring.rows[0] });
		}
		const result = await pool.query(`SELECT e.id,e.title,e.description,e.starts_at AS "startAt",e.ends_at AS "endAt",e.status,e.image_url AS "imageUrl",
			e.category,e.requires_registration AS "requiresRegistration", 'EVENT' AS "programType", $2::text AS timezone,
			COALESCE(l.name,e.location_text) AS location,l.address,l.latitude,l.longitude FROM events e LEFT JOIN program_locations l ON l.id=e.location_id
			WHERE e.id=$1 AND e.status IN ('PUBLISHED','POSTPONED','CANCELLED') AND e.deleted_at IS NULL`, [request.params.id, config.churchTimezone]);
		if (!result.rowCount) return response.status(404).json({ error: 'Event was not found.' });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function dailyVerse(_request, response) {
	try {
		const date = churchDate();
		let result = await pool.query(`SELECT p.id,p.publication_date AS "publicationDate",p.reflection,p.explanation,p.publication_source AS source,
			v.book,v.chapter,v.verse_start AS "verseStart",v.verse_end AS "verseEnd",v.verse_text AS text,v.translation,v.language
			FROM daily_verse_publications p JOIN bible_verses v ON v.id=p.verse_id
			WHERE p.publication_date=$1 AND p.status='PUBLISHED' AND p.publish_to_website=TRUE`, [date]);
		if (!result.rowCount) { await publishAutomaticDailyVerse(date); result = await pool.query(`SELECT p.id,p.publication_date AS "publicationDate",p.reflection,p.explanation,p.publication_source AS source,v.book,v.chapter,v.verse_start AS "verseStart",v.verse_end AS "verseEnd",v.verse_text AS text,v.translation,v.language FROM daily_verse_publications p JOIN bible_verses v ON v.id=p.verse_id WHERE p.publication_date=$1 AND p.status='PUBLISHED' AND p.publish_to_website=TRUE`, [date]); }
		// An empty licensed verse library is a valid initial state, not a client
		// error. Administrators must import/verify an authorized verse first.
		if (!result.rowCount) return response.status(204).end();
		const verse = result.rows[0];
		verse.reference = `${verse.book} ${verse.chapter}:${verse.verseStart}${verse.verseEnd ? `-${verse.verseEnd}` : ''} (${verse.translation})`;
		return response.json({ success: true, data: verse });
	} catch (error) { return requestError(error, response); }
}

export async function listBibleVerses(request, response) {
	try {
		const { page, limit, offset } = pageParams(request.query);
		const [items, count] = await Promise.all([
			pool.query(`SELECT p.id,p.publication_date AS "publicationDate",p.reflection,p.explanation,p.background_image_url AS "backgroundImageUrl",v.book,v.chapter,v.verse_start AS "verseStart",v.verse_end AS "verseEnd",v.verse_text AS text,v.translation,v.language
				FROM daily_verse_publications p JOIN bible_verses v ON v.id=p.verse_id
				WHERE p.status='PUBLISHED' AND p.publish_to_website=TRUE
				ORDER BY p.publication_date DESC LIMIT $1 OFFSET $2`, [limit, offset]),
			pool.query(`SELECT count(*)::int AS total FROM daily_verse_publications WHERE status='PUBLISHED' AND publish_to_website=TRUE`),
		]);
		const verses = items.rows.map((verse) => ({ ...verse, reference: `${verse.book} ${verse.chapter}:${verse.verseStart}${verse.verseEnd ? `-${verse.verseEnd}` : ''} (${verse.translation})` }));
		return paged(response, verses, { page, limit }, count.rows[0].total);
	} catch (error) { return requestError(error, response); }
}

export async function listAnnouncements(_request, response) {
	try { const result = await pool.query(`SELECT id,title,body,image_url AS "imageUrl",published_at AS "publishedAt" FROM announcements WHERE status='PUBLISHED' AND deleted_at IS NULL ORDER BY published_at DESC LIMIT 100`); return response.json({ success: true, data: result.rows }); } catch (error) { return requestError(error, response); }
}
export async function listCampaigns(_request, response) {
	try {
		const result = await pool.query(`SELECT c.id,c.title,c.description,c.goal_amount AS "goalAmount",c.currency,c.starts_at AS "startsAt",c.ends_at AS "endsAt",c.status,c.banner_url AS "bannerUrl",c.cta_url AS "ctaUrl",dc.name AS category,
			COALESCE(SUM(d.amount) FILTER (WHERE d.status='APPROVED' AND d.deleted_at IS NULL AND d.currency=c.currency),0)::numeric AS "raisedAmount",
			CASE WHEN c.status='CLOSED' OR (c.ends_at IS NOT NULL AND c.ends_at < NOW()) THEN 'COMPLETED' WHEN c.starts_at IS NOT NULL AND c.starts_at > NOW() THEN 'UPCOMING' ELSE 'ACTIVE' END AS "displayStatus"
			FROM fundraising_campaigns c LEFT JOIN donation_categories dc ON dc.id=c.category_id LEFT JOIN donations d ON d.campaign_id=c.id
			WHERE c.status IN ('ACTIVE','CLOSED') GROUP BY c.id,dc.name ORDER BY c.starts_at DESC NULLS LAST,c.created_at DESC`);
		return response.json({ success: true, data: result.rows });
	} catch (error) { return requestError(error, response); }
}
export async function listPartners(_request, response) {
	try { const result = await pool.query(`SELECT id,name,website_url AS "websiteUrl",logo_url AS "logoUrl" FROM partners WHERE is_public=TRUE AND deleted_at IS NULL ORDER BY name`); return response.json({ success: true, data: result.rows }); } catch (error) { return requestError(error, response); }
}
export async function schedules(_request, response) {
	try {
		const result = await pool.query(`SELECT s.id,p.name,s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.weekday,s.start_time AS "startTime",s.end_time AS "endTime",s.status,l.name AS "locationName",l.address,l.latitude,l.longitude,
			CASE
				WHEN s.weekday BETWEEN 0 AND 6 AND s.start_time IS NOT NULL THEN
					(((NOW() AT TIME ZONE COALESCE(s.timezone,$1))::date
					 + ((s.weekday - EXTRACT(DOW FROM (NOW() AT TIME ZONE COALESCE(s.timezone,$1))::date)::integer + 7) % 7)
					 + CASE WHEN ((s.weekday - EXTRACT(DOW FROM (NOW() AT TIME ZONE COALESCE(s.timezone,$1))::date)::integer + 7) % 7) = 0
						AND s.start_time <= (NOW() AT TIME ZONE COALESCE(s.timezone,$1))::time THEN 7 ELSE 0 END
					 + s.start_time) AT TIME ZONE COALESCE(s.timezone,$1))
				WHEN s.starts_at >= NOW() THEN s.starts_at
				ELSE NULL
			END AS "nextAt", COALESCE(s.timezone,$1) AS timezone
			FROM program_schedules s JOIN programs p ON p.id=s.program_id LEFT JOIN program_locations l ON l.id=s.location_id
			WHERE p.is_active=TRUE AND p.deleted_at IS NULL AND s.status IN ('ACTIVE','SCHEDULED')
			AND ((s.weekday BETWEEN 0 AND 6 AND s.start_time IS NOT NULL) OR s.starts_at >= NOW())
			ORDER BY "nextAt" NULLS LAST,p.name,s.id`, [config.churchTimezone]);
		return response.json({ success: true, data: result.rows, timezone: config.churchTimezone });
	} catch (error) { return requestError(error, response); }
}

export async function listBibleStudyGroups(_request, response) {
	try { const result = await pool.query(`SELECT g.id,g.name,g.description,g.meeting_schedule AS "meetingSchedule",l.name AS location,u.name AS "leaderName" FROM bible_study_groups g LEFT JOIN program_locations l ON l.id=g.location_id LEFT JOIN users u ON u.id=g.leader_user_id WHERE g.is_public=TRUE AND g.deleted_at IS NULL ORDER BY g.name`); return response.json({ success:true,data:result.rows }); } catch (error) { return requestError(error,response); }
}
export async function getBibleStudyGroup(request, response) {
	try { const result = await pool.query(`SELECT g.id,g.name,g.description,g.meeting_schedule AS "meetingSchedule",g.capacity,l.name AS location,u.name AS "leaderName" FROM bible_study_groups g LEFT JOIN program_locations l ON l.id=g.location_id LEFT JOIN users u ON u.id=g.leader_user_id WHERE g.id=$1 AND g.is_public=TRUE AND g.deleted_at IS NULL`, [request.params.id]); if (!result.rowCount) return response.status(404).json({error:'Bible study group was not found.'}); return response.json({success:true,data:result.rows[0]}); } catch(error) { return requestError(error,response); }
}
export async function listMedia(type, response) {
	try { const result=await pool.query(`SELECT id,title,description,media_url AS "mediaUrl",thumbnail_url AS "thumbnailUrl",published_at AS "publishedAt" FROM media_items WHERE type=$1 AND is_public=TRUE AND deleted_at IS NULL ORDER BY published_at DESC NULLS LAST`,[type]); return response.json({success:true,data:result.rows}); } catch(error) { return requestError(error,response); }
}
export const listSermons = (_request,response) => listMedia('SERMON',response);
export const listBanners = (_request,response) => listMedia('BANNER',response);
export async function listOrganizations(_request,response) {
	try { const result=await pool.query(`SELECT id,name,description,image_url AS "imageUrl" FROM organizations WHERE is_public=TRUE AND is_active=TRUE AND deleted_at IS NULL ORDER BY name`); return response.json({success:true,data:result.rows}); } catch(error) { return requestError(error,response); }
}
export async function getOrganization(request,response) {
	try { const result=await pool.query(`SELECT id,name,description,image_url AS "imageUrl" FROM organizations WHERE id=$1 AND is_public=TRUE AND is_active=TRUE AND deleted_at IS NULL`,[request.params.id]); if(!result.rowCount)return response.status(404).json({error:'Organization was not found.'}); return response.json({success:true,data:result.rows[0]}); }catch(error){return requestError(error,response);}
}
export async function organizationDepartments(request,response) {
	try { const result=await pool.query(`SELECT id,name,description FROM departments WHERE organization_id=$1 AND is_active=TRUE AND deleted_at IS NULL ORDER BY name`,[request.params.id]); return response.json({success:true,data:result.rows}); }catch(error){return requestError(error,response);}
}
export async function getDepartment(request,response) {
	try { const result=await pool.query(`SELECT d.id,d.name,d.description,o.name AS "organizationName",u.name AS "leaderName" FROM departments d LEFT JOIN organizations o ON o.id=d.organization_id LEFT JOIN users u ON u.id=d.leader_user_id WHERE d.id=$1 AND d.is_active=TRUE AND d.deleted_at IS NULL`,[request.params.id]); if(!result.rowCount)return response.status(404).json({error:'Department was not found.'});return response.json({success:true,data:result.rows[0]}); }catch(error){return requestError(error,response);}
}
export async function getBankAccount(_request, response) {
	try {
		const result = await pool.query(`SELECT key,value FROM system_settings WHERE key IN ('paymentMethods','bank_account','bankName','accountHolder','accountNumber','bankBranch','transferInstructions','currency')`);
		const settings = Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
		const methods = normalizePaymentMethods(settings.paymentMethods, settings);
		const primary = methods[0] ?? null;
		return response.json({ success: true, data: {
			methods,
			bankName: primary?.type === 'BANK' ? primary.name : '',
			accountHolder: primary?.accountHolder ?? '',
			accountNumber: primary?.accountNumber ?? '',
			bankBranch: primary?.branch ?? '',
			transferInstructions: primary?.instructions ?? '',
			currency: primary?.currency ?? 'ETB',
		} });
	} catch (error) {
		return requestError(error, response);
	}
}

export async function listGivingCategories(_request, response) {
	try {
		const result = await pool.query(`SELECT id,name,description FROM donation_categories WHERE is_active=TRUE ORDER BY name`);
		return response.json({ success:true, data:result.rows });
	} catch(error) { return requestError(error,response); }
}

export async function submitContact(request,response) {
	try { const b=request.body??{}; const name=requiredString(b.name,'Name',160);const email=requiredString(b.email,'Email',320).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Object.assign(new Error('Enter a valid email address.'),{status:400});const subject=requiredString(b.subject,'Subject',200);const message=requiredString(b.message,'Message',10000);const phone=typeof b.phone==='string'&&b.phone.trim()?b.phone.trim().slice(0,40):null;const result=await pool.query(`INSERT INTO contact_messages(name,email,phone,subject,message) VALUES($1,$2,$3,$4,$5) RETURNING id`,[name,email,phone,subject,message]);return response.status(201).json({success:true,data:{id:result.rows[0].id},message:'Your message has been sent.'}); }catch(error){return requestError(error,response);}
}

export async function submitNewChristian(request, response) {
	try {
		const submission = normalizeNewChristianSubmission(request.body ?? {});
		const linkSecret = randomBytes(32).toString('base64url');
		const linkSecretHash = createHash('sha256').update(linkSecret).digest('hex');
		const result = await pool.query(
			`INSERT INTO new_christian_followups (
				full_name, phone, email, location, preferred_contact_method,
				preferred_language, accepted_jesus, consent_to_contact, prayer_request, status, link_secret_hash, link_secret_expires_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '24 hours')
			RETURNING id, full_name AS "fullName", phone, email, location,
				preferred_contact_method AS "preferredContactMethod",
				preferred_language AS "preferredLanguage",
				accepted_jesus AS "acceptedJesus", consent_to_contact AS "consentToContact",
				prayer_request AS "prayerRequest", status, created_at AS "createdAt"`,
			[
				submission.fullName,
				submission.phone,
				submission.email,
				submission.location,
				submission.preferredContactMethod,
				submission.preferredLanguage,
				submission.acceptedJesus,
				submission.consentToContact,
				submission.prayerRequest,
				submission.status,
				linkSecretHash,
			],
		);

		const newRecord = result.rows[0];
		let emailDelivery = { status: 'SKIPPED', reason: 'No email address was provided.' };
		if (submission.email) {
			await pool.query(`UPDATE new_christian_followups SET email_delivery_status='PENDING', email_delivery_error=NULL WHERE id=$1`, [newRecord.id]);
			try {
				const welcome = createNewChristianWelcomeEmail(submission.fullName);
				emailDelivery = await sendEmailNotification({ to: submission.email, ...welcome });
				await pool.query(`UPDATE new_christian_followups SET email_delivery_status='DELIVERED', email_delivery_error=NULL WHERE id=$1`, [newRecord.id]);
				emailDelivery = { status: 'DELIVERED' };
			} catch (error) {
				const message = error.message || 'The welcome email could not be delivered.';
				await pool.query(`UPDATE new_christian_followups SET email_delivery_status='FAILED', email_delivery_error=$2 WHERE id=$1`, [newRecord.id, message.slice(0, 1000)]);
				emailDelivery = { status: 'FAILED', error: message };
				console.error('[new-christian] welcome email failed:', error.message);
			}
		}

		return response.status(201).json({
			success: true,
			data: newRecord,
			linkSecret,
			notifications: { email: emailDelivery },
			message: submission.acceptedJesus
				? 'Thank you for sharing this step of faith with us. Our follow-up team will reach out soon.'
				: 'Thank you for being open with us. We would love to pray with you and help you take your next step.',
		});
	} catch (error) {
		return requestError(error, response);
	}
}
