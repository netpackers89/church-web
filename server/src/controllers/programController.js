import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { requestError, requiredString } from '../utils/http.js';
import { queueEventNotifications } from '../services/eventNotificationService.js';

export async function listDepartments(_request, response) {
  try {
    const result = await pool.query(`SELECT d.id,d.name,d.description,d.category,d.logo_url AS "logoUrl",d.banner_url AS "bannerUrl",d.meeting_location AS "meetingLocation",d.meeting_schedule AS "meetingSchedule",d.community_links AS "communityLinks",d.telegram_type AS "telegramType",d.telegram_username AS "telegramUsername",d.telegram_public_link AS "telegramPublicLink",d.telegram_invite_link AS "telegramInviteLink",d.leader_user_id AS "leaderUserId",d.organization_id AS "organizationId",d.visibility,d.is_active AS "isActive",o.name AS "organizationName",COALESCE(u.name,d.leader_name) AS "leaderName",(SELECT COUNT(*)::int FROM department_members dm WHERE dm.department_id=d.id AND dm.status='ACTIVE') AS "memberCount" FROM departments d LEFT JOIN organizations o ON o.id=d.organization_id LEFT JOIN users u ON u.id=d.leader_user_id WHERE d.deleted_at IS NULL ORDER BY d.name`);
    return response.json({ success: true, data: result.rows.map(withAdminCommunityLinks) });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listOrganizations(_request, response) {
  try {
    const result = await pool.query(`SELECT o.id,o.name,o.description,o.image_url AS "imageUrl",o.is_public AS "isPublic",o.is_active AS "isActive",
      o.leader_user_id AS "leaderUserId",u.name AS "leaderName",
      count(DISTINCT d.id)::int AS "departmentCount"
      FROM organizations o LEFT JOIN users u ON u.id=o.leader_user_id
      LEFT JOIN departments d ON d.organization_id=o.id AND d.deleted_at IS NULL
      WHERE o.deleted_at IS NULL GROUP BY o.id,u.name ORDER BY o.name`);
    return response.json({ success: true, data: result.rows });
  } catch (error) { return requestError(error, response); }
}

export async function createOrganization(request, response) {
  try {
    const body = request.body ?? {};
    const name = requiredString(body.name, 'Organization name', 150);
    const description = optionalText(body.description, 5000);
    const isPublic = body.isPublic !== false;
    const isActive = body.isActive !== false;
    const leaderUserId = body.leaderUserId ? Number(body.leaderUserId) : null;
    if (leaderUserId !== null && (!Number.isSafeInteger(leaderUserId) || leaderUserId < 1)) {
      throw Object.assign(new Error('Select a valid organization leader.'), { status: 400 });
    }
    const imageUrl = optionalHttpsUrl(body.imageUrl, 'Organization image URL');
    const result = await pool.query(`INSERT INTO organizations(name,description,leader_user_id,is_public,is_active,image_url)
      VALUES($1,$2,$3,$4,$5,$6)
      RETURNING id,name,description,image_url AS "imageUrl",leader_user_id AS "leaderUserId",is_public AS "isPublic",is_active AS "isActive"`,
    [name, description, leaderUserId, isPublic, isActive, imageUrl]);
    await audit({ actorUserId: request.user.id, action: 'ORGANIZATION_CREATED', entityType: 'organization', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) });
    return response.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { return requestError(error, response); }
}
async function registeredGroupLeader(client, value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('Select a registered member or staff account as the leader.'), { status: 400 });
  const result = await client.query(
    `SELECT id,name FROM users WHERE id=$1 AND account_status='ACTIVE' AND deleted_at IS NULL`,
    [id],
  );
  if (!result.rowCount) throw Object.assign(new Error('The selected leader account is not active or no longer exists.'), { status: 400 });
  return result.rows[0];
}

export async function createDepartment(request,response) {
  let client;
  try {
    const body = request.body ?? {};
    const name = requiredString(body.name, 'Department name', 160);
    const visibility = String(body.visibility ?? 'PUBLIC').toUpperCase();
    if (!['PUBLIC', 'PRIVATE'].includes(visibility)) throw Object.assign(new Error('Visibility must be PUBLIC or PRIVATE.'), { status: 400 });
    const telegram = registrationTelegramFields(body);
    const communityLinks = registrationCommunityLinks(body.communityLinks);
    client = await pool.connect();
    await client.query('BEGIN');
    const leader = await registeredGroupLeader(client, body.leaderUserId);
    const result = await client.query(
      `INSERT INTO departments(name,description,organization_id,leader_user_id,leader_name,leader_phone,contact_email,category,logo_url,banner_url,visibility,is_active,telegram_type,telegram_username,telegram_public_link,telegram_invite_link,telegram_connection_status,community_links,meeting_location,meeting_schedule)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'UNVERIFIED',$17::jsonb,$18,$19)
       RETURNING id,name,description,leader_user_id AS "leaderUserId",leader_name AS "leaderName",leader_phone AS "leaderPhone",contact_email AS "contactEmail",category,logo_url AS "logoUrl",banner_url AS "bannerUrl",visibility,is_active AS "isActive",telegram_connection_status AS "telegramConnectionStatus",community_links AS "communityLinks",meeting_location AS "meetingLocation",meeting_schedule AS "meetingSchedule"`,
      [name, optionalText(body.description, 5000), body.organizationId || null, leader?.id ?? null, leader?.name ?? null, optionalText(body.leaderPhone, 40), optionalText(body.contactEmail, 320), optionalText(body.category, 100), optionalHttpsUrl(body.logoUrl, 'Logo URL'), optionalHttpsUrl(body.bannerUrl, 'Banner URL'), visibility, body.isActive !== false, ...telegram, JSON.stringify(communityLinks), optionalText(body.meetingLocation, 500), optionalText(body.meetingSchedule, 500)],
    );
    if (leader) await client.query(
      `INSERT INTO department_members(user_id,department_id,role,status) VALUES($1,$2,'LEADER','ACTIVE')
       ON CONFLICT(user_id,department_id) DO UPDATE SET role='LEADER',status='ACTIVE'`,
      [leader.id, result.rows[0].id],
    );
    await audit({ actorUserId: request.user.id, action: 'DEPARTMENT_CREATED', entityType: 'department', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) }, client);
    await client.query('COMMIT');
    return response.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return requestError(error, response);
  } finally { client?.release(); }
}

function optionalText(value, max) {
  if (value == null || value === '') return null;
  return requiredString(value, 'A registration field', max);
}

function optionalHttpsUrl(value, label, allowedHosts = null) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw Object.assign(new Error(`${label} must be a valid HTTPS URL.`), { status: 400 });
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error(`${label} must be a valid HTTPS URL.`), { status: 400 }); }
  if (url.protocol !== 'https:' || url.username || url.password || (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase()))) {
    throw Object.assign(new Error(`${label} must use an approved HTTPS address.`), { status: 400 });
  }
  return url.toString();
}

function registrationTelegramFields(body) {
  const type = String(body.telegramType ?? 'none').toLowerCase();
  if (!['none', 'group', 'channel'].includes(type)) throw Object.assign(new Error('Telegram destination type is invalid.'), { status: 400 });
  if (type === 'none') return ['none', null, null, null];
  const username = optionalText(body.telegramUsername, 64);
  if (username && !/^@?[A-Za-z0-9_]{5,32}$/.test(username)) throw Object.assign(new Error('Enter a valid Telegram username.'), { status: 400 });
  const publicLink = optionalHttpsUrl(body.telegramPublicLink, 'Telegram public link', ['t.me', 'www.t.me']);
  const inviteLink = optionalHttpsUrl(body.telegramInviteLink, 'Telegram invitation link', ['t.me', 'www.t.me']);
  if (!username && !publicLink && !inviteLink) throw Object.assign(new Error('Add a Telegram username or link, or choose "Not connected".'), { status: 400 });
  return [type, username, publicLink, inviteLink];
}

function registrationCommunityLinks(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw Object.assign(new Error('Provide no more than 20 community links.'), { status: 400 });
  }
  const allowedPlatforms = new Set(['telegram', 'facebook', 'youtube']);
  return value.map((link) => {
    const platform = typeof link?.platform === 'string' ? link.platform.toLowerCase() : '';
    if (!allowedPlatforms.has(platform)) {
      throw Object.assign(new Error('Choose a supported community link platform.'), { status: 400 });
    }
    const url = optionalHttpsUrl(link.url, 'Community link URL');
    if (!url) throw Object.assign(new Error('Every community link requires a URL.'), { status: 400 });
    if (link.enabled != null && typeof link.enabled !== 'boolean') {
      throw Object.assign(new Error('Community link enabled state must be true or false.'), { status: 400 });
    }
    return {
      platform,
      label: optionalText(link.label, 80) || platform,
      url,
      enabled: link.enabled !== false,
    };
  });
}

function withAdminCommunityLinks(group) {
  const supportedPlatforms = new Set(['telegram', 'facebook', 'youtube']);
  const links = Array.isArray(group.communityLinks)
    ? group.communityLinks.filter((link) => supportedPlatforms.has(String(link?.platform ?? '').toLowerCase()))
    : [];
  const configuredPlatforms = new Set(links.map((link) => link?.platform));
  if (!configuredPlatforms.has('telegram')) {
    if (group.telegramPublicLink) links.push({ platform: 'telegram', label: 'Telegram public link', url: group.telegramPublicLink, enabled: true });
    if (group.telegramInviteLink) links.push({ platform: 'telegram', label: 'Telegram invitation link', url: group.telegramInviteLink, enabled: true });
  }
  if (group.facebookUrl && !configuredPlatforms.has('facebook')) {
    links.push({ platform: 'facebook', label: 'Facebook group', url: group.facebookUrl, enabled: true });
  }
  if (group.youtubeUrl && !configuredPlatforms.has('youtube')) {
    links.push({ platform: 'youtube', label: 'YouTube channel', url: group.youtubeUrl, enabled: true });
  }
  return { ...group, communityLinks: links };
}

export async function updateDepartmentCommunityLinks(request, response) {
  return updateCommunityLinks(request, response, 'departments', 'department', 'DEPARTMENT_COMMUNITY_LINKS_UPDATED');
}

export async function updateBibleStudyCommunityLinks(request, response) {
  return updateCommunityLinks(request, response, 'bible_study_groups', 'bible_study_group', 'BIBLE_STUDY_COMMUNITY_LINKS_UPDATED');
}

async function updateCommunityLinks(request, response, table, entityType, action) {
  try {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return response.status(400).json({ error: 'A valid group ID is required.' });
    }
    if (!Array.isArray(request.body?.communityLinks)) {
      return response.status(400).json({ error: 'Community links must be provided as a list.' });
    }
    const communityLinks = registrationCommunityLinks(request.body?.communityLinks);
    const result = await pool.query(
      `UPDATE ${table}
       SET community_links = $1::jsonb, telegram_public_link = NULL, telegram_invite_link = NULL,
           facebook_url = NULL, youtube_url = NULL
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, community_links AS "communityLinks"`,
      [JSON.stringify(communityLinks), id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Group was not found.' });
    await audit({ actorUserId: request.user.id, action, entityType, entityId: id, after: result.rows[0], ipAddress: clientIp(request) });
    return response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listBibleStudyGroups(_request, response) {
  try {
    const result = await pool.query(`SELECT g.id,g.name,g.description,g.meeting_schedule AS "meetingSchedule",g.location_text AS location,g.location_text AS "locationText",g.group_profile_image AS "groupProfileImage",g.banner_image AS "bannerImage",g.group_email AS "groupEmail",g.google_maps_link AS "googleMapsLink",g.current_study AS "currentStudy",g.community_links AS "communityLinks",g.telegram_type AS "telegramType",g.telegram_username AS "telegramUsername",g.telegram_public_link AS "telegramPublicLink",g.telegram_invite_link AS "telegramInviteLink",g.leader_user_id AS "leaderUserId",g.visibility,g.capacity,g.is_active AS "isActive",g.is_public AS "isPublic",COALESCE(u.name,g.leader_name) AS "leaderName",g.telegram_connection_status AS "telegramConnectionStatus",(SELECT COUNT(*)::int FROM bible_study_memberships bsm WHERE bsm.bible_study_group_id=g.id AND bsm.status='ACTIVE') AS "memberCount" FROM bible_study_groups g LEFT JOIN users u ON u.id=g.leader_user_id WHERE g.deleted_at IS NULL ORDER BY g.name`);
    return response.json({ success: true, data: result.rows.map(withAdminCommunityLinks) });
  } catch (error) { return requestError(error, response); }
}
function programDefaults(body = {}) {
  const name = requiredString(body.name, 'Program name', 160);
  const category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) || null : null;
  const location = typeof body.defaultLocation === 'string' ? body.defaultLocation.trim().slice(0, 500) || null : null;
  const startTime = typeof body.defaultStartTime === 'string' && body.defaultStartTime ? body.defaultStartTime : null;
  const endTime = typeof body.defaultEndTime === 'string' && body.defaultEndTime ? body.defaultEndTime : null;
  const weekday = body.recurrenceWeekday === '' || body.recurrenceWeekday == null ? null : Number(body.recurrenceWeekday);
  const dateValue = (value, label) => {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
      throw Object.assign(new Error(`${label} must be a valid calendar date.`), { status: 400 });
    }
    return value;
  };
  const recurrenceStartDate = dateValue(body.recurrenceStartDate, 'Recurrence start date');
  const recurrenceEndDate = dateValue(body.recurrenceEndDate, 'Recurrence end date');
  if ((startTime && !/^\d{2}:\d{2}$/.test(startTime)) || (endTime && !/^\d{2}:\d{2}$/.test(endTime))) throw Object.assign(new Error('Use valid default start and end times.'), { status: 400 });
  if ((startTime === null) !== (endTime === null)) throw Object.assign(new Error('Provide both default start and end times.'), { status: 400 });
  if (weekday !== null && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !startTime)) throw Object.assign(new Error('Weekly recurrence requires a weekday and default start and end times.'), { status: 400 });
  if (recurrenceStartDate && recurrenceEndDate && recurrenceStartDate > recurrenceEndDate) throw Object.assign(new Error('Recurrence end date must be on or after its start date.'), { status: 400 });
  if (weekday === null && (recurrenceStartDate || recurrenceEndDate)) throw Object.assign(new Error('Choose a weekly recurrence day before setting a recurrence date range.'), { status: 400 });
  return {
    name,
    description: typeof body.description === 'string' ? body.description.trim().slice(0, 5000) || null : null,
    category,
    departmentId: body.departmentId ? Number(body.departmentId) : null,
    imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl.trim().slice(0, 2000) || null : null,
    defaultLocation: location,
    defaultStartTime: startTime,
    defaultEndTime: endTime,
    recurrenceWeekday: weekday,
    recurrenceStartDate,
    recurrenceEndDate,
    notifyMembers: body.notifyMembers === true,
    notifyAllMembers: body.notifyAllMembers === true,
    isActive: body.isActive !== false,
  };
}

async function syncProgramSchedule(client, programId, defaults) {
  const existing = await client.query('SELECT id FROM program_schedules WHERE program_id=$1 ORDER BY id LIMIT 1 FOR UPDATE', [programId]);
  if (defaults.recurrenceWeekday === null) {
    if (existing.rowCount) await client.query("UPDATE program_schedules SET status='CANCELLED',recurrence_start_date=NULL,recurrence_end_date=NULL,updated_at=NOW() WHERE id=$1", [existing.rows[0].id]);
    return;
  }
  const status = defaults.isActive ? 'SCHEDULED' : 'CANCELLED';
  const scheduleValues = [programId, defaults.recurrenceWeekday, defaults.defaultStartTime, defaults.defaultEndTime, defaults.defaultLocation, defaults.recurrenceStartDate, defaults.recurrenceEndDate, status];
  if (existing.rowCount) {
    await client.query(`UPDATE program_schedules SET weekday=$2,start_time=$3,end_time=$4,location_text=$5,
      recurrence_start_date=$6,recurrence_end_date=$7,recurrence_rule='FREQ=WEEKLY',
      status=$8,updated_at=NOW() WHERE id=$1`, [existing.rows[0].id, ...scheduleValues.slice(1)]);
  } else {
    await client.query(`INSERT INTO program_schedules(program_id,weekday,start_time,end_time,location_text,
      recurrence_start_date,recurrence_end_date,recurrence_rule,timezone,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,'FREQ=WEEKLY','Africa/Addis_Ababa',$8)`, scheduleValues);
  }
}

export async function listPrograms(_request, response) {
  try {
    const result = await pool.query(`SELECT p.id,p.name,p.description,p.category,p.image_url AS "imageUrl",
      p.default_location AS "defaultLocation",p.default_start_time::text AS "defaultStartTime",
      p.default_end_time::text AS "defaultEndTime",p.recurrence_weekday AS "recurrenceWeekday",
      s.recurrence_start_date AS "recurrenceStartDate",s.recurrence_end_date AS "recurrenceEndDate",
      p.notify_members AS "notifyMembers",p.notify_all_members AS "notifyAllMembers",
      p.is_active AS "isActive",p.department_id AS "departmentId",d.name AS "departmentName",
      count(e.id)::int AS "promotedEventCount"
      FROM programs p LEFT JOIN departments d ON d.id=p.department_id
      LEFT JOIN LATERAL (
        SELECT recurrence_start_date,recurrence_end_date
        FROM program_schedules WHERE program_id=p.id ORDER BY id LIMIT 1
      ) s ON TRUE
      LEFT JOIN events e ON e.program_id=p.id AND e.deleted_at IS NULL
      WHERE p.deleted_at IS NULL GROUP BY p.id,d.name,s.recurrence_start_date,s.recurrence_end_date ORDER BY p.name`);
    return response.json({ success: true, data: result.rows });
  } catch (error) { return requestError(error, response); }
}

export async function createProgram(request, response) {
  const client = await pool.connect();
  try {
    const defaults = programDefaults(request.body);
    await client.query('BEGIN');
    const result = await client.query(`INSERT INTO programs(name,description,department_id,created_by,category,image_url,
      default_location,default_start_time,default_end_time,recurrence_weekday,notify_members,notify_all_members,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id,name,description,category,image_url AS "imageUrl",default_location AS "defaultLocation",
      default_start_time::text AS "defaultStartTime",default_end_time::text AS "defaultEndTime",recurrence_weekday AS "recurrenceWeekday",
      notify_members AS "notifyMembers",notify_all_members AS "notifyAllMembers",is_active AS "isActive"`,
    [defaults.name, defaults.description, defaults.departmentId, request.user.id, defaults.category, defaults.imageUrl,
     defaults.defaultLocation, defaults.defaultStartTime, defaults.defaultEndTime, defaults.recurrenceWeekday, defaults.notifyMembers, defaults.notifyAllMembers, defaults.isActive]);
    await syncProgramSchedule(client, result.rows[0].id, defaults);
    await client.query('COMMIT');
    await audit({ actorUserId: request.user.id, action: 'PROGRAM_CREATED', entityType: 'program', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) });
    return response.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); return requestError(error, response); }
  finally { client.release(); }
}

export async function updateProgram(request, response) {
  const client = await pool.connect();
  try {
    const defaults = programDefaults(request.body);
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM programs WHERE id=$1 AND deleted_at IS NULL FOR UPDATE', [request.params.id]);
    if (!existing.rowCount) { await client.query('ROLLBACK'); return response.status(404).json({ error: 'Program template was not found.' }); }
    const result = await client.query(`UPDATE programs SET name=$2,description=$3,category=$4,department_id=$5,image_url=$6,
      default_location=$7,default_start_time=$8,default_end_time=$9,recurrence_weekday=$10,
      notify_members=$11,notify_all_members=$12,is_active=$13,updated_at=NOW() WHERE id=$1
      RETURNING id,name,description,category,image_url AS "imageUrl",default_location AS "defaultLocation",
      default_start_time::text AS "defaultStartTime",default_end_time::text AS "defaultEndTime",recurrence_weekday AS "recurrenceWeekday",
      notify_members AS "notifyMembers",notify_all_members AS "notifyAllMembers",is_active AS "isActive"`,
    [request.params.id, defaults.name, defaults.description, defaults.category, defaults.departmentId, defaults.imageUrl,
     defaults.defaultLocation, defaults.defaultStartTime, defaults.defaultEndTime, defaults.recurrenceWeekday, defaults.notifyMembers, defaults.notifyAllMembers, defaults.isActive]);
    await syncProgramSchedule(client, request.params.id, defaults);
    await client.query('COMMIT');
    await audit({ actorUserId: request.user.id, action: 'PROGRAM_TEMPLATE_UPDATED', entityType: 'program', entityId: request.params.id, after: result.rows[0], ipAddress: clientIp(request) });
    return response.json({ success: true, data: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); return requestError(error, response); }
  finally { client.release(); }
}

export async function promoteProgramToEvent(request, response) {
  const client = await pool.connect();
  let event;
  try {
    const body = request.body ?? {};
    const startsAt = new Date(body.startsAt);
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (Number.isNaN(startsAt.valueOf()) || (endsAt && (Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt))) {
      throw Object.assign(new Error('Choose a valid event start and end time.'), { status: 400 });
    }
    await client.query('BEGIN');
    const template = await client.query(`SELECT id,name,description,category,image_url,default_location,notify_members,
      notify_all_members,department_id,is_active FROM programs WHERE id=$1 AND deleted_at IS NULL FOR SHARE`, [request.params.id]);
    if (!template.rowCount || !template.rows[0].is_active) throw Object.assign(new Error('This program template is unavailable.'), { status: 404 });
    const program = template.rows[0];
    const title = requiredString(body.title || program.name, 'Event title', 200);
    const guestSpeaker = typeof body.guestSpeaker === 'string' ? body.guestSpeaker.trim().slice(0, 200) || null : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 5000) || null : null;
    const description = [program.description, guestSpeaker ? `Guest speaker: ${guestSpeaker}` : null, notes].filter(Boolean).join('\n\n') || null;
    const notifyMembers = typeof body.notifyMembers === 'boolean' ? body.notifyMembers : program.notify_members;
    const notifyAllMembers = typeof body.notifyAllMembers === 'boolean' ? body.notifyAllMembers : program.notify_all_members;
    const departmentId = body.audienceDepartmentId ? Number(body.audienceDepartmentId) : program.department_id;
    const result = await client.query(`INSERT INTO events(program_id,title,description,location_text,starts_at,ends_at,status,image_url,category,
      requires_registration,audience_department_id,notify_members,notify_all_members,guest_speaker,created_by)
      VALUES($1,$2,$3,$4,$5,$6,'PUBLISHED',$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id::text AS id,program_id AS "programId",title,description,starts_at AS "startAt",ends_at AS "endAt",
      location_text AS location,status,image_url AS "imageUrl",category,requires_registration AS "requiresRegistration",
      audience_department_id AS "audienceDepartmentId",notify_members AS "notifyMembers",notify_all_members AS "notifyAllMembers"`,
    [program.id, title, description, typeof body.location === 'string' && body.location.trim() ? body.location.trim().slice(0, 500) : program.default_location,
     startsAt, endsAt, typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim().slice(0, 2000) : program.image_url,
     program.category, body.requiresRegistration === true, departmentId, notifyMembers, notifyAllMembers, guestSpeaker, request.user.id]);
    event = result.rows[0];
    await client.query('COMMIT');
    await audit({ actorUserId: request.user.id, action: 'PROGRAM_PROMOTED_TO_EVENT', entityType: 'event', entityId: event.id, after: event, ipAddress: clientIp(request) });
    await queueEventNotifications(event);
    return response.status(201).json({ success: true, data: event });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505' && error.constraint === 'events_program_start_unique') {
      return response.status(409).json({ error: 'This program already has an event at that start time.' });
    }
    return requestError(error, response);
  } finally { client.release(); }
}
export async function createSchedule(request,response) {
	try {
		const b=request.body??{}; const isOneOff=Boolean(b.startsAt && b.endsAt); const isRecurring=Number.isInteger(b.weekday)&&/^\d{2}:\d{2}/.test(b.startTime||'')&&/^\d{2}:\d{2}/.test(b.endTime||'');
		if(!isOneOff&&!isRecurring)throw Object.assign(new Error('Provide startsAt and endsAt, or weekday, startTime, and endTime.'),{status:400});
		const result=await pool.query(`INSERT INTO program_schedules(program_id,location_id,starts_at,ends_at,weekday,start_time,end_time,recurrence_rule,timezone,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,program_id AS "programId",starts_at AS "startsAt",ends_at AS "endsAt",weekday,start_time AS "startTime",end_time AS "endTime",status`,[request.params.id,b.locationId||null,isOneOff?new Date(b.startsAt):null,isOneOff?new Date(b.endsAt):null,isRecurring?b.weekday:null,isRecurring?b.startTime:null,isRecurring?b.endTime:null,b.recurrenceRule||null,b.timezone||'Africa/Addis_Ababa',b.status||'SCHEDULED']);
		await audit({actorUserId:request.user.id,action:'PROGRAM_SCHEDULE_CREATED',entityType:'program_schedule',entityId:result.rows[0].id,after:result.rows[0],ipAddress:clientIp(request)});return response.status(201).json({success:true,data:result.rows[0]});
	}catch(error){return requestError(error,response);}
}
export async function setScheduleOverride(request, response) {
	try {
		const occurrenceDate = request.params.date;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate) || Number.isNaN(Date.parse(`${occurrenceDate}T00:00:00Z`))) {
			throw Object.assign(new Error('Provide a valid occurrence date in YYYY-MM-DD format.'), { status: 400 });
		}
		const status = String(request.body?.status ?? '').toUpperCase();
		if (!['CANCELLED', 'POSTPONED', 'RESCHEDULED'].includes(status)) {
			throw Object.assign(new Error('Status must be CANCELLED, POSTPONED, or RESCHEDULED.'), { status: 400 });
		}
		const startsAt = request.body?.startsAt ? new Date(request.body.startsAt) : null;
		const endsAt = request.body?.endsAt ? new Date(request.body.endsAt) : null;
		if ((startsAt && Number.isNaN(startsAt.valueOf())) || (endsAt && Number.isNaN(endsAt.valueOf())) || (endsAt && startsAt && endsAt <= startsAt)) {
			throw Object.assign(new Error('Provide valid override times with the end after the start.'), { status: 400 });
		}
		if (status === 'RESCHEDULED' && (!startsAt || !endsAt)) {
			throw Object.assign(new Error('Rescheduled occurrences require both startsAt and endsAt.'), { status: 400 });
		}
		const result = await pool.query(`INSERT INTO program_schedule_overrides
			(schedule_id,occurrence_date,status,starts_at,ends_at,location_text,note)
			SELECT s.id,$2,$3,$4,$5,$6,$7 FROM program_schedules s WHERE s.id=$1
			ON CONFLICT (schedule_id,occurrence_date) DO UPDATE SET status=EXCLUDED.status,
				starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
				location_text=EXCLUDED.location_text,note=EXCLUDED.note,updated_at=NOW()
			RETURNING id,schedule_id AS "scheduleId",occurrence_date AS "occurrenceDate",status,
				starts_at AS "startsAt",ends_at AS "endsAt",location_text AS location,note`,
		[request.params.id, occurrenceDate, status, startsAt, endsAt, request.body?.location || null, typeof request.body?.note === 'string' ? request.body.note.trim().slice(0, 1000) || null : null]);
		if (!result.rowCount) return response.status(404).json({ error: 'Program schedule was not found.' });
		await audit({ actorUserId: request.user.id, action: 'PROGRAM_SCHEDULE_OVERRIDE_SET', entityType: 'program_schedule_override', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}
export async function createBibleStudyGroup(request,response) {
  let client;
  try {
    const body = request.body ?? {};
    const name = requiredString(body.name, 'Group name', 160);
    const capacity = body.capacity == null || body.capacity === '' ? null : Number(body.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) throw Object.assign(new Error('Maximum members must be a positive whole number.'), { status: 400 });
    const mapsLink = optionalHttpsUrl(body.googleMapsLink, 'Google Maps link', ['maps.google.com', 'maps.app.goo.gl', 'www.google.com']);
    if (mapsLink && new URL(mapsLink).hostname === 'www.google.com' && !new URL(mapsLink).pathname.startsWith('/maps')) throw Object.assign(new Error('Provide a Google Maps link.'), { status: 400 });
    const telegram = registrationTelegramFields(body);
    const communityLinks = registrationCommunityLinks(body.communityLinks);
    client = await pool.connect();
    await client.query('BEGIN');
    const leader = await registeredGroupLeader(client, body.leaderUserId);
    const result = await client.query(
      `INSERT INTO bible_study_groups(name,description,meeting_schedule,leader_user_id,is_public,visibility,group_email,location_text,google_maps_link,current_study,capacity,group_profile_image,banner_image,leader_name,leader_phone,is_active,telegram_type,telegram_username,telegram_public_link,telegram_invite_link,telegram_connection_status,community_links)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'UNVERIFIED',$21::jsonb)
       RETURNING id,name,description,meeting_schedule AS "meetingSchedule",leader_user_id AS "leaderUserId",group_email AS "groupEmail",location_text AS "locationText",google_maps_link AS "googleMapsLink",current_study AS "currentStudy",capacity,leader_name AS "leaderName",leader_phone AS "leaderPhone",is_public AS "isPublic",is_active AS "isActive",telegram_connection_status AS "telegramConnectionStatus",community_links AS "communityLinks"`,
      [name, optionalText(body.description, 5000), optionalText(body.meetingSchedule, 500), leader?.id ?? null, body.isPublic !== false, body.isPublic === false ? 'private' : 'public', optionalText(body.groupEmail, 320), optionalText(body.locationText, 500), mapsLink, optionalText(body.currentStudy, 500), capacity, optionalHttpsUrl(body.groupProfileImage, 'Profile image URL'), optionalHttpsUrl(body.bannerImage, 'Banner image URL'), leader?.name ?? null, optionalText(body.leaderPhone, 40), body.isActive !== false, ...telegram, JSON.stringify(communityLinks)],
    );
    if (leader) await client.query(
      `INSERT INTO bible_study_memberships(user_id,bible_study_group_id,role,status) VALUES($1,$2,'LEADER','ACTIVE')`,
      [leader.id, result.rows[0].id],
    );
    await audit({ actorUserId: request.user.id, action: 'BIBLE_STUDY_GROUP_CREATED', entityType: 'bible_study_group', entityId: result.rows[0].id, after: result.rows[0], ipAddress: clientIp(request) }, client);
    await client.query('COMMIT');
    return response.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return requestError(error, response);
  } finally { client?.release(); }
}

export async function getDepartmentById(request, response) {
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.description, d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
        d.category, d.leader_user_id AS "leaderUserId", d.leader_phone AS "leaderPhone", d.is_active AS "isActive",
        d.visibility, d.enrollment_open AS "enrollmentOpen", d.requires_approval AS "requiresApproval",
        d.min_age AS "minAge", d.max_age AS "maxAge", d.eligibility_enabled AS "eligibilityEnabled",
        d.organization_id AS "organizationId", d.meeting_location AS "meetingLocation",
        d.meeting_schedule AS "meetingSchedule", d.community_links AS "communityLinks",
        d.telegram_type AS "telegramType", d.telegram_username AS "telegramUsername",
        d.telegram_public_link AS "telegramPublicLink", d.telegram_invite_link AS "telegramInviteLink",
        d.telegram_verified_at AS "telegramVerifiedAt", d.telegram_verify_error AS "telegramVerifyError",
        d.telegram_connection_status AS "telegramConnectionStatus",
        o.name AS "organizationName", u.name AS "leaderName", u.email AS "leaderEmail"
       FROM departments d
       LEFT JOIN organizations o ON o.id = d.organization_id
       LEFT JOIN users u ON u.id = d.leader_user_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [request.params.id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Department was not found.' });
    const department = result.rows[0];

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.account_status AS "accountStatus", dm.role AS "memberRole"
       FROM department_members dm
       JOIN users u ON u.id = dm.user_id
       WHERE dm.department_id = $1 AND dm.status='ACTIVE'
       ORDER BY u.name`,
      [request.params.id],
    );

    const postResult = await pool.query(
      `SELECT a.id, a.title, a.body AS "bodyText", a.image_url AS "imageUrl", a.featured,
        COALESCE(a.started_at, a.published_at) AS "startedAt"
       FROM announcements a WHERE a.department_id = $1 ORDER BY a.published_at DESC LIMIT 20`,
      [request.params.id],
    );

    return response.json({
      success: true,
      data: { ...department, memberCount: membersResult.rows.length, postCount: postResult.rows.length },
      meta: { members: membersResult.rows, posts: postResult.rows },
    });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function getBibleStudyGroupById(request, response) {
  try {
    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.google_maps_link AS "googleMapsLink", g.location_text AS "locationText",
        g.group_email AS "groupEmail", g.meeting_schedule AS "meetingSchedule", g.current_study AS "currentStudy",
        g.capacity AS "capacity", g.group_profile_image AS "groupProfileImage", g.banner_image AS "bannerImage",
        g.leader_user_id AS "leaderUserId", g.leader_phone AS "leaderPhone", g.is_public AS "isPublic",
        g.is_active AS "isActive", g.visibility, g.community_links AS "communityLinks",
        g.telegram_type AS "telegramType", g.telegram_username AS "telegramUsername",
        g.telegram_public_link AS "telegramPublicLink", g.telegram_invite_link AS "telegramInviteLink",
        g.telegram_verified_at AS "telegramVerifiedAt", g.telegram_verify_error AS "telegramVerifyError",
        g.telegram_connection_status AS "telegramConnectionStatus",
        u.name AS "leaderName", u.email AS "leaderEmail"
       FROM bible_study_groups g
       LEFT JOIN users u ON u.id = g.leader_user_id
       WHERE g.id = $1 AND g.deleted_at IS NULL`,
      [request.params.id],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Bible study group was not found.' });
    const group = result.rows[0];

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.account_status AS "accountStatus", bsm.role AS "memberRole"
       FROM bible_study_memberships bsm
       JOIN users u ON u.id = bsm.user_id
       WHERE bsm.bible_study_group_id = $1 AND bsm.status='ACTIVE'
       ORDER BY u.name`,
      [request.params.id],
    );

    const postResult = await pool.query(
      `SELECT a.id, a.title, a.body AS "bodyText", a.image_url AS "imageUrl", a.featured,
        COALESCE(a.started_at, a.published_at) AS "startedAt"
       FROM announcements a WHERE a.bible_study_group_id = $1 ORDER BY a.published_at DESC LIMIT 20`,
      [request.params.id],
    );

    const registered = membersResult.rows.length;
    const capacity = group.capacity || null;
    const availability = capacity ? Math.max(0, capacity - registered) : null;

    return response.json({
      success: true,
      data: { ...group, memberCount: registered, postCount: postResult.rows.length, capacity, remainingCapacity: availability },
      meta: { members: membersResult.rows, posts: postResult.rows },
    });
  } catch (error) {
    return requestError(error, response);
  }
}
