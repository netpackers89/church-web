import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { requestError, requiredString } from '../utils/http.js';
import { queueEventNotifications } from '../services/eventNotificationService.js';

function dates(body) {
	const startsAt = new Date(body.startsAt || body.startAt || body.starts_at);
	const rawEnd = body.endsAt || body.endAt || body.ends_at;
	const endsAt = rawEnd ? new Date(rawEnd) : null;
	if (Number.isNaN(startsAt.valueOf()) || (endsAt && (Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt))) throw Object.assign(new Error('Provide a valid start time and an end time after it.'), { status: 400 });
	return { startsAt, endsAt };
}

export async function listAdminEvents(_request, response) {
	try {
		const result = await pool.query(`SELECT e.id::text AS id,e.program_id AS "programId",e.title,e.description,
			e.starts_at AS "startAt",e.ends_at AS "endAt",e.status,e.image_url AS "imageUrl",e.category,
			e.guest_speaker AS "guestSpeaker",e.requires_registration AS "requiresRegistration",
			e.audience_department_id AS "audienceDepartmentId",e.notify_members AS "notifyMembers",
			e.notify_all_members AS "notifyAllMembers",COALESCE(l.name,e.location_text) AS location
			FROM events e LEFT JOIN program_locations l ON l.id=e.location_id
			WHERE e.deleted_at IS NULL ORDER BY e.starts_at DESC LIMIT 200`);
		return response.json({ success: true, data: result.rows });
	} catch (error) { return requestError(error, response); }
}

export async function createEvent(request, response) {
	try {
		const { startsAt, endsAt } = dates(request.body ?? {}); const title = requiredString(request.body?.title, 'Title', 200);
		const status = String(request.body?.status || 'DRAFT').toUpperCase();
		if (!['DRAFT', 'PUBLISHED'].includes(status)) throw Object.assign(new Error('New events must be saved as DRAFT or PUBLISHED.'), { status: 400 });
		const category = typeof request.body.category === 'string' ? request.body.category.trim().slice(0, 80) || null : null;
		const guestSpeaker = typeof request.body.guestSpeaker === 'string' ? request.body.guestSpeaker.trim().slice(0, 200) || null : null;
		const result = await pool.query(`INSERT INTO events(title,description,location_text,starts_at,ends_at,capacity,status,image_url,category,requires_registration,audience_department_id,notify_members,notify_all_members,guest_speaker,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id,title,starts_at AS "startAt",ends_at AS "endAt",location_text AS location,status,image_url AS "imageUrl",category,guest_speaker AS "guestSpeaker",requires_registration AS "requiresRegistration",audience_department_id AS "audienceDepartmentId",notify_members AS "notifyMembers",notify_all_members AS "notifyAllMembers"`, [title, request.body.description || null, request.body.location || request.body.locationText || null, startsAt, endsAt, request.body.capacity ?? null, status, request.body.imageUrl || null, category, Boolean(request.body.requiresRegistration), request.body.audienceDepartmentId || null, Boolean(request.body.notifyMembers), Boolean(request.body.notifyAllMembers), guestSpeaker, request.user.id]);
		await audit({ actorUserId: request.user.id, action: 'EVENT_CREATED', entityType: 'event', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) });
		if (result.rows[0].status === 'PUBLISHED') await queueEventNotifications(result.rows[0]);
		return response.status(201).json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}
export async function updateEvent(request, response) {
	try {
		const existing = await pool.query('SELECT * FROM events WHERE id=$1 AND deleted_at IS NULL', [request.params.id]); if (!existing.rowCount) return response.status(404).json({ error: 'Event not found.' });
		const data = { ...existing.rows[0], ...request.body }; const { startsAt, endsAt } = dates(data); const title = requiredString(data.title, 'Title', 200);
		const status = String(data.status || 'DRAFT').toUpperCase();
		if (!['DRAFT', 'PUBLISHED', 'CANCELLED', 'POSTPONED'].includes(status)) throw Object.assign(new Error('Event status must be DRAFT, PUBLISHED, CANCELLED, or POSTPONED.'), { status: 400 });
		const guestSpeaker = typeof data.guestSpeaker === 'string' ? data.guestSpeaker.trim().slice(0, 200) || null : data.guest_speaker ?? null;
		const result = await pool.query(`UPDATE events SET title=$2,description=$3,location_text=$4,starts_at=$5,ends_at=$6,capacity=$7,status=$8,image_url=$9,category=$10,requires_registration=$11,audience_department_id=$12,notify_members=$13,notify_all_members=$14,guest_speaker=$15,updated_at=NOW() WHERE id=$1 RETURNING id,title,starts_at AS "startAt",ends_at AS "endAt",location_text AS location,status,image_url AS "imageUrl",category,guest_speaker AS "guestSpeaker",requires_registration AS "requiresRegistration",audience_department_id AS "audienceDepartmentId",notify_members AS "notifyMembers",notify_all_members AS "notifyAllMembers"`, [request.params.id,title,data.description || null,data.location || data.location_text || null,startsAt,endsAt,data.capacity ?? null,status,data.imageUrl ?? data.image_url ?? null,data.category ?? null,Boolean(data.requiresRegistration ?? data.requires_registration),data.audienceDepartmentId ?? data.audience_department_id ?? null,Boolean(data.notifyMembers ?? data.notify_members),Boolean(data.notifyAllMembers ?? data.notify_all_members),guestSpeaker]);
		await audit({ actorUserId: request.user.id, action: 'EVENT_UPDATED', entityType: 'event', entityId: request.params.id, before: existing.rows[0], after: result.rows[0], ipAddress: clientIp(request) });
		if (result.rows[0].status === 'PUBLISHED') await queueEventNotifications(result.rows[0]);
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}
export async function deleteEvent(request, response) {
	try { const result = await pool.query(`UPDATE events SET deleted_at=NOW(),status='ARCHIVED',updated_at=NOW() WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [request.params.id]); if (!result.rowCount) return response.status(404).json({ error: 'Event not found.' }); await audit({ actorUserId: request.user.id, action: 'EVENT_ARCHIVED', entityType: 'event', entityId: request.params.id, ipAddress: clientIp(request) }); return response.status(204).end(); } catch (error) { return requestError(error, response); }
}
export async function registerForEvent(request, response) {
	try {
		const result = await pool.query(`INSERT INTO event_registrations(event_id,user_id,status)
			SELECT id,$2,'REGISTERED' FROM events WHERE id=$1 AND status='PUBLISHED'
			AND requires_registration=TRUE AND deleted_at IS NULL
			ON CONFLICT (event_id,user_id) DO NOTHING
			RETURNING id,event_id AS "eventId",status`, [request.params.id, request.user.id]);
		if (result.rowCount) return response.status(201).json({ success: true, data: result.rows[0] });
		const existing = await pool.query(`SELECT r.id,r.event_id AS "eventId",r.status FROM event_registrations r
			JOIN events e ON e.id=r.event_id WHERE r.event_id=$1 AND r.user_id=$2
			AND e.status='PUBLISHED' AND e.requires_registration=TRUE AND e.deleted_at IS NULL`, [request.params.id, request.user.id]);
		if (!existing.rowCount) return response.status(404).json({ error: 'Event is not available or does not require registration.' });
		return response.json({ success: true, data: existing.rows[0], message: 'You are already registered for this event.' });
	} catch (error) { return requestError(error, response); }
}
