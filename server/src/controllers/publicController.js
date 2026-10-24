import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { createHash, randomBytes } from 'node:crypto';
import { churchDate, publishAutomaticDailyVerse } from '../services/dailyVerseService.js';
import { createNewChristianWelcomeEmail, sendEmailNotification } from '../email/index.js';
import { pageParams, paged, requestError } from '../utils/http.js';
import { requiredString } from '../utils/http.js';
import { normalizePaymentMethods } from '../services/paymentMethods.js';
import { GROUP_SOURCE, resolveJoin, joinGroup, createPendingJoinRequest, listPublicDepartments as fetchPublicDepartments, findDepartmentById } from '../services/groupMembershipService.js';
import { sendGroupJoinConfirmation } from '../services/groupJoinNotification.js';

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
				AND e.audience_group_id IS NULL AND e.audience_group_type IS NULL
			ORDER BY e.starts_at ASC
		`);
		const schedules = await pool.query(`
			WITH RECURSIVE anchors AS (
				SELECT s.id AS schedule_id, p.id AS program_id, p.name, p.description,
					p.category AS program_category, COALESCE(s.image_url, p.image_url) AS image_url,
					s.status AS schedule_status, s.weekday, s.start_time, s.end_time,
					COALESCE(s.timezone, $1) AS timezone, s.recurrence_start_date,
					s.recurrence_end_date, COALESCE(l.name, s.location_text, '') AS location,
					GREATEST(
						(NOW() AT TIME ZONE COALESCE(s.timezone, $1))::date,
						COALESCE(s.recurrence_start_date, (NOW() AT TIME ZONE COALESCE(s.timezone, $1))::date)
					) AS anchor_date
				FROM program_schedules s
				JOIN programs p ON p.id=s.program_id AND p.is_active=TRUE AND p.deleted_at IS NULL
				LEFT JOIN program_locations l ON l.id=s.location_id
				WHERE s.status IN ('ACTIVE','SCHEDULED')
					AND s.weekday BETWEEN 0 AND 6
					AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL
					AND (s.recurrence_end_date IS NULL OR s.recurrence_end_date >= (NOW() AT TIME ZONE COALESCE(s.timezone, $1))::date)
			), occurrence_seeds AS (
				SELECT anchors.*,
					anchor_date + ((weekday - EXTRACT(DOW FROM anchor_date)::int + 7) % 7) AS occurrence_date
				FROM anchors
			), occurrences AS (
				SELECT * FROM occurrence_seeds
				UNION ALL
				SELECT schedule_id, program_id, name, description, program_category, image_url,
					schedule_status, weekday, start_time, end_time, timezone, recurrence_start_date,
					recurrence_end_date, location, anchor_date, occurrence_date + 7
				FROM occurrences
				WHERE occurrence_date < (NOW() AT TIME ZONE timezone)::date + 90
					AND (recurrence_end_date IS NULL OR occurrence_date + 7 <= recurrence_end_date)
			), scheduled AS (
				SELECT o.*,
					((o.occurrence_date::timestamp + o.start_time) AT TIME ZONE o.timezone) AS occurrence_start,
					((o.occurrence_date::timestamp + o.end_time
						+ CASE WHEN o.end_time <= o.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END)
						AT TIME ZONE o.timezone) AS occurrence_end
				FROM occurrences o
			), eligible AS (
				SELECT o.*, COALESCE(x.status, 'SCHEDULED') AS override_status,
					COALESCE(x.starts_at, o.occurrence_start) AS final_start,
					COALESCE(x.ends_at, o.occurrence_end) AS final_end,
					COALESCE(x.location_text, o.location) AS final_location
				FROM scheduled o
				LEFT JOIN program_schedule_overrides x ON x.schedule_id=o.schedule_id AND x.occurrence_date=o.occurrence_date
				WHERE (x.status IS NULL OR x.status <> 'CANCELLED')
					AND (o.recurrence_end_date IS NULL OR o.occurrence_date <= o.recurrence_end_date)
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
		`, [config.churchTimezone]);

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

export async function calendarEvents(request, response) {
	try {
		const { from, to } = request.query;
		const isDate = (value) => typeof value === 'string'
			&& /^\d{4}-\d{2}-\d{2}$/.test(value)
			&& !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
			&& new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
		if (!isDate(from) || !isDate(to) || from > to) {
			return response.status(400).json({ error: 'Provide a valid calendar date range.' });
		}
		const rangeDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
		if (rangeDays > 366) return response.status(400).json({ error: 'Calendar ranges cannot exceed 367 days.' });

		const [events, occurrences] = await Promise.all([
			pool.query(`
				SELECT e.id::text AS id,e.title,e.description,e.starts_at AS "startAt",e.ends_at AS "endAt",
					e.status,e.image_url AS "imageUrl",e.category,e.requires_registration AS "requiresRegistration",
					'EVENT' AS "programType",COALESCE(l.name,e.location_text) AS location,$3::text AS timezone
				FROM events e LEFT JOIN program_locations l ON l.id=e.location_id
				WHERE e.status IN ('PUBLISHED','POSTPONED') AND e.deleted_at IS NULL
					AND e.audience_group_id IS NULL AND e.audience_group_type IS NULL
					AND (e.starts_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
				ORDER BY e.starts_at`,
				[from, to, config.churchTimezone],
			),
			pool.query(`
				WITH RECURSIVE occurrences AS (
					SELECT s.id AS schedule_id,p.id AS program_id,p.name,p.description,p.category,
						COALESCE(s.image_url,p.image_url) AS image_url,s.status AS schedule_status,
						s.weekday,s.start_time,s.end_time,COALESCE(s.timezone,$3) AS timezone,
						s.recurrence_start_date,s.recurrence_end_date,
						COALESCE(l.name,s.location_text,'') AS location,
						(GREATEST($1::date,COALESCE(s.recurrence_start_date,$1::date))
							+ ((s.weekday-EXTRACT(DOW FROM GREATEST($1::date,COALESCE(s.recurrence_start_date,$1::date)))::int+7)%7)) AS occurrence_date
					FROM program_schedules s
					JOIN programs p ON p.id=s.program_id AND p.is_active=TRUE AND p.deleted_at IS NULL
					LEFT JOIN program_locations l ON l.id=s.location_id
					WHERE s.status IN ('ACTIVE','SCHEDULED') AND s.weekday BETWEEN 0 AND 6
						AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL
						AND (s.recurrence_start_date IS NULL OR s.recurrence_start_date <= $2::date)
						AND (s.recurrence_end_date IS NULL OR s.recurrence_end_date >= $1::date)
					UNION ALL
					SELECT schedule_id,program_id,name,description,category,image_url,schedule_status,
						weekday,start_time,end_time,timezone,recurrence_start_date,recurrence_end_date,location,occurrence_date+7
					FROM occurrences WHERE occurrence_date+7 <= $2::date
						AND (recurrence_end_date IS NULL OR occurrence_date+7 <= recurrence_end_date)
				)
				SELECT CONCAT('program-',o.schedule_id,'-',o.occurrence_date::text) AS id,
					o.name AS title,o.description,
					COALESCE(x.starts_at,((o.occurrence_date::timestamp+o.start_time) AT TIME ZONE o.timezone)) AS "startAt",
					COALESCE(x.ends_at,((o.occurrence_date::timestamp+o.end_time+
						CASE WHEN o.end_time<=o.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END) AT TIME ZONE o.timezone)) AS "endAt",
					CASE WHEN x.status='POSTPONED' THEN 'POSTPONED' ELSE 'PUBLISHED' END AS status,
					o.image_url AS "imageUrl",COALESCE(o.category,'Regular Program') AS category,
					FALSE AS "requiresRegistration",'RECURRING' AS "programType",
					COALESCE(x.location_text,o.location) AS location,o.timezone
				FROM occurrences o
				LEFT JOIN program_schedule_overrides x
					ON x.schedule_id=o.schedule_id AND x.occurrence_date=o.occurrence_date
				WHERE (x.status IS NULL OR x.status<>'CANCELLED')
					AND o.occurrence_date BETWEEN $1::date AND $2::date
					AND (o.recurrence_end_date IS NULL OR o.occurrence_date<=o.recurrence_end_date)
					AND NOT EXISTS (
						SELECT 1 FROM events promoted
						WHERE promoted.program_id=o.program_id AND promoted.deleted_at IS NULL
							AND (promoted.starts_at AT TIME ZONE o.timezone)::date=o.occurrence_date
					)
				ORDER BY "startAt"`,
				[from, to, config.churchTimezone],
			),
		]);
		const data = [...events.rows, ...occurrences.rows]
			.filter((event) => event.startAt)
			.sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
		return response.json({ success: true, data, timezone: config.churchTimezone });
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
			const parsedOccurrenceDate = new Date(`${occurrenceDate}T00:00:00Z`);
			if (Number.isNaN(parsedOccurrenceDate.getTime()) || parsedOccurrenceDate.toISOString().slice(0, 10) !== occurrenceDate) {
				return response.status(404).json({ error: 'Scheduled program occurrence was not found.' });
			}
			const recurring = await pool.query(`
				SELECT CONCAT('program-', s.id, '-', $2::date::text) AS id, p.name AS title, p.description,
					COALESCE(x.starts_at, (($2::date::timestamp + s.start_time) AT TIME ZONE COALESCE(s.timezone,$3))) AS "startAt",
					COALESCE(x.ends_at, (($2::date::timestamp + s.end_time + CASE WHEN s.end_time <= s.start_time THEN INTERVAL '1 day' ELSE INTERVAL '0 days' END) AT TIME ZONE COALESCE(s.timezone,$3))) AS "endAt",
					CASE WHEN x.status='POSTPONED' THEN 'POSTPONED' ELSE 'PUBLISHED' END AS status,
					COALESCE(s.image_url, p.image_url) AS "imageUrl", p.category,
					FALSE AS "requiresRegistration", 'RECURRING' AS "programType", COALESCE(s.timezone,$3) AS timezone,
					COALESCE(x.location_text, l.name, '') AS location
				FROM program_schedules s JOIN programs p ON p.id=s.program_id
				LEFT JOIN program_locations l ON l.id=s.location_id
				LEFT JOIN program_schedule_overrides x ON x.schedule_id=s.id AND x.occurrence_date=$2::date
				WHERE s.id=$1 AND p.is_active=TRUE AND p.deleted_at IS NULL
					AND s.status IN ('ACTIVE','SCHEDULED') AND s.weekday=EXTRACT(DOW FROM $2::date)::int
					AND (s.recurrence_start_date IS NULL OR s.recurrence_start_date<=$2::date)
					AND (s.recurrence_end_date IS NULL OR s.recurrence_end_date>=$2::date)
					AND (x.status IS NULL OR x.status <> 'CANCELLED')
			`, [scheduleId, occurrenceDate, config.churchTimezone]);
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
			COALESCE((
				SELECT json_agg(json_build_object(
				'id',pa.id::text,'name',pa.name,'type',pa.type,'accountHolder',pa.account_holder,
				'accountNumber',pa.account_number,'phoneNumber',pa.phone_number,'branch',pa.branch,
				'instructions',pa.instructions,'currency',pa.currency
				) ORDER BY pa.id)
				FROM campaign_payment_accounts pa WHERE pa.campaign_id=c.id AND pa.is_active=TRUE
			), '[]'::json) AS "paymentAccounts",
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
		const result = await pool.query(`WITH candidates AS (
				SELECT s.*,p.name AS program_name,p.is_active,p.deleted_at AS program_deleted_at,
					l.name AS "locationName",l.address,l.latitude,l.longitude,
					COALESCE(s.timezone,$1) AS resolved_timezone,
					NOW() AT TIME ZONE COALESCE(s.timezone,$1) AS local_now
				FROM program_schedules s
				JOIN programs p ON p.id=s.program_id
				LEFT JOIN program_locations l ON l.id=s.location_id
				WHERE p.is_active=TRUE AND p.deleted_at IS NULL AND s.status IN ('ACTIVE','SCHEDULED')
			), anchors AS (
				SELECT *,GREATEST(local_now::date,COALESCE(recurrence_start_date,local_now::date)) AS anchor_date
				FROM candidates
			), occurrences AS (
				SELECT *,anchor_date+((weekday-EXTRACT(DOW FROM anchor_date)::int+7)%7) AS candidate_date
				FROM anchors
			), next_dates AS (
				SELECT *,candidate_date+CASE
					WHEN candidate_date=local_now::date AND start_time<=local_now::time THEN 7
					ELSE 0
				END AS next_date
				FROM occurrences
			)
			SELECT id,program_id AS "programId",program_name AS name,starts_at AS "startsAt",ends_at AS "endsAt",weekday,
				start_time AS "startTime",end_time AS "endTime",status,"locationName",address,latitude,longitude,
				CASE
					WHEN weekday BETWEEN 0 AND 6 AND start_time IS NOT NULL THEN
						((next_date::timestamp+start_time) AT TIME ZONE resolved_timezone)
					WHEN starts_at>=NOW() THEN starts_at
					ELSE NULL
				END AS "nextAt",resolved_timezone AS timezone
			FROM next_dates
			WHERE ((weekday BETWEEN 0 AND 6 AND start_time IS NOT NULL)
					AND (recurrence_start_date IS NULL OR recurrence_start_date<=next_date)
					AND (recurrence_end_date IS NULL OR recurrence_end_date>=next_date))
				OR (weekday IS NULL AND starts_at>=NOW())
			ORDER BY "nextAt" NULLS LAST,name,id`, [config.churchTimezone]);
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

// ---- Public group directory (visible to unauthenticated visitors) ----
export async function listPublicDepartments(request, response) {
  try {
    const departments = await fetchPublicDepartments();
    return response.json({ success: true, data: departments });
  } catch (error) { return requestError(error, response); }
}

export async function getPublicDepartment(request, response) {
  try {
    const department = await findDepartmentById(Number(request.params.id));
    if (!department) return response.status(404).json({ error: 'Department was not found.' });
    return response.json({ success: true, data: department });
  } catch (error) { return requestError(error, response); }
}

export async function joinDepartment(request, response) {
  try {
    const check = await resolveJoin({ request, source: GROUP_SOURCE.DEPARTMENT, id: Number(request.params.id) });
    if (check.status === 'already_member') return response.status(200).json({ success: true, data: { status: 'already_member', group: check.group }, message: 'You are already a member of this group.' });
    if (check.status === 'already_requested') return response.status(200).json({ success: true, data: { status: 'already_requested', group: check.group, requestId: check.requestId }, message: 'A join request for this group is already pending.' });
    const joined = await joinGroup(request, GROUP_SOURCE.DEPARTMENT, check.record);

    // Send join confirmation (email + Telegram) — non-blocking
    try {
      const user = request.user;
      const group = check.group;
      await sendGroupJoinConfirmation({
        user: { id: user.id, name: user.name, email: user.email, notify_email: user.notify_email, telegram_chat_id: user.telegram_chat_id, notify_telegram: user.notify_telegram },
        group: { id: group.id, name: group.name, description: group.description, bannerUrl: group.bannerUrl || group.banner_url, logoUrl: group.logoUrl || group.logo_url, telegramPublicLink: group.telegramPublicLink || group.telegram_public_link, telegramUsername: group.telegramUsername || group.telegram_username },
        groupTypeLabel: 'Department',
        churchContact: [config.branding.email, config.branding.phone].filter(Boolean).join(' · '),
        churchWebsite: config.branding.websiteUrl,
        churchSocialLinks: [
          { label: 'Website', url: config.branding.websiteUrl, color: '#6366F1' },
          { label: 'Telegram', url: config.branding.telegramUrl, color: '#0088cc' },
        ],
      }).catch((error) => console.error('[group join] notification failed:', error.message));
    } catch { /* notification errors are non-fatal */ }

    return response.status(201).json({ success: true, data: { status: 'joined', group: joined.group }, message: "You're in! Welcome to the group." });
  } catch (error) { return requestError(error, response); }
}

export async function joinBibleStudyGroup(request, response) {
  try {
    const check = await resolveJoin({ request, source: GROUP_SOURCE.BIBLE_STUDY_GROUP, id: Number(request.params.id) });
    if (check.status === 'already_member') return response.status(200).json({ success: true, data: { status: 'already_member', group: check.group }, message: 'You are already a member of this group.' });
    if (check.status === 'already_requested') return response.status(200).json({ success: true, data: { status: 'already_requested', group: check.group, requestId: check.requestId }, message: 'A join request for this group is already pending.' });
    const joined = await joinGroup(request, GROUP_SOURCE.BIBLE_STUDY_GROUP, check.record);

    // Send join confirmation (email + Telegram) — non-blocking
    try {
      const user = request.user;
      const group = check.group;
      await sendGroupJoinConfirmation({
        user: { id: user.id, name: user.name, email: user.email, notify_email: user.notify_email, telegram_chat_id: user.telegram_chat_id, notify_telegram: user.notify_telegram },
        group: { id: group.id, name: group.name, description: group.description, bannerUrl: group.bannerUrl || group.banner_image, logoUrl: group.logoUrl || group.group_profile_image, telegramPublicLink: group.telegramPublicLink || group.telegram_public_link, telegramUsername: group.telegramUsername || group.telegram_username },
        groupTypeLabel: 'Bible Study Group',
        churchContact: [config.branding.email, config.branding.phone].filter(Boolean).join(' · '),
        churchWebsite: config.branding.websiteUrl,
        churchSocialLinks: [
          { label: 'Website', url: config.branding.websiteUrl, color: '#6366F1' },
          { label: 'Telegram', url: config.branding.telegramUrl, color: '#0088cc' },
        ],
      }).catch((error) => console.error('[group join] notification failed:', error.message));
    } catch { /* notification errors are non-fatal */ }

    return response.status(201).json({ success: true, data: { status: 'joined', group: joined.group }, message: "You're in! Welcome to the group." });
  } catch (error) { return requestError(error, response); }
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
		const result = await pool.query(`SELECT id,name,description,category_code AS "categoryCode" FROM donation_categories WHERE is_active=TRUE ORDER BY name`);
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
