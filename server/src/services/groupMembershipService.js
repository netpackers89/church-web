import { pool } from '../config/db.js';
import { requestError } from '../utils/http.js';

export const GROUP_SOURCE = { DEPARTMENT: 'department', BIBLE_STUDY_GROUP: 'bible_study_group' };

export function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return Boolean(value);
}

export function buildGroupPayload(row) {
  const data = row ?? {};
  return {
    id: data.id,
    name: data.name,
    description: data.description ?? null,
    visibility: data.visibility ?? 'public',
    isPublic: normalizeBoolean(data.is_public, true),
    leaderName: data.leader_name ?? null,
    leaderUserId: data.leader_user_id ?? null,
    logoUrl: data.logoUrl ?? data.group_profile_image ?? data.logo_url ?? null,
    bannerUrl: data.bannerUrl ?? data.banner_image ?? data.banner_url ?? null,
    locationText: data.location_text ?? null,
    googleMapsLink: data.google_maps_link ?? null,
    currentStudy: data.current_study ?? null,
    meetingSchedule: data.meeting_schedule ?? null,
    groupEmail: data.group_email ?? data.contact_email ?? null,
    telegramType: data.telegram_type ?? null,
    telegramUsername: data.telegram_username ?? null,
    telegramPublicLink: data.telegram_public_link ?? null,
    telegramInviteLink: data.telegram_invite_link ?? null,
    telegramConnectionStatus: data.telegram_connection_status ?? null,
    enrollmentOpen: normalizeBoolean(data.enrollment_open, true),
    requiresApproval: normalizeBoolean(data.requires_approval, false),
    capacity: data.capacity ?? null,
    isAcceptingMembers: data.is_active === true && data.enrollment_open,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function findGroupById(id) {
  const result = await pool.query(
    `SELECT g.id, g.name, g.description, g.visibility, g.is_active, g.enrollment_open,
      g.requires_approval, g.capacity, g.is_public, g.leader_user_id, g.leader_name, g.contact_email,
      g.group_email, g.location_text, g.google_maps_link, g.current_study,
      g.group_profile_image AS "groupProfileImage", g.banner_image AS "bannerImage",
      g.telegram_type, g.telegram_username, g.telegram_public_link, g.telegram_invite_link,
      g.telegram_connection_status, g.created_at, g.updated_at
     FROM bible_study_groups g WHERE g.id = $1 AND g.deleted_at IS NULL`, [id],
  );
  return result.rows[0] ?? null;
}

export async function findDepartmentById(id) {
  const result = await pool.query(
    `SELECT d.id, d.name, d.description, d.visibility, d.is_active, d.deleted_at, d.leader_user_id,
      d.leader_name, d.location_id, d.meeting_schedule, d.capacity, d.enrollment_open, d.is_public,
      d.group_email, d.contact_email, d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
      d.category, d.google_maps_link, d.location_text, d.telegram_type, d.telegram_username,
      d.telegram_public_link, d.telegram_invite_link, d.telegram_connection_status, d.created_at, d.updated_at
     FROM departments d WHERE d.id = $1 AND d.deleted_at IS NULL`, [id],
  );
  return result.rows[0] ?? null;
}

export async function resolveJoin({ request, source, id }) {
  const isAuth = request.user !== null && request.user !== undefined;
  if (!isAuth) {
    throw Object.assign(new Error('You must be signed in to join a group.'), { status: 401 });
  }
  const actorId = String(request.user.id);

  if (source === GROUP_SOURCE.DEPARTMENT) {
    const department = await findDepartmentById(id);
    if (!department) throw Object.assign(new Error('Department was not found.'), { status: 404 });
    validateDepartmentJoin(department);
    const membership = await findDepartmentMembership(department.id, actorId);
    if (membership) return { status: 'already_member', group: buildGroupPayload(department) };
    const pending = await findPendingJoinRequest(department.id, actorId, null, null);
    if (pending) return { status: 'already_requested', group: buildGroupPayload(department), requestId: pending.id };
    return { source: GROUP_SOURCE.DEPARTMENT, record: department };
  }

  const group = await findGroupById(id);
  if (!group) throw Object.assign(new Error('Group was not found.'), { status: 404 });
  validateGroupJoin(group);
  const membership = await findBibleStudyMembership(group.id, actorId);
  if (membership) return { status: 'already_member', group: buildGroupPayload(group) };
  const pending = await findPendingJoinRequest(null, null, group.id, actorId);
  if (pending) return { status: 'already_requested', group: buildGroupPayload(group), requestId: pending.id };
  return { source: GROUP_SOURCE.BIBLE_STUDY_GROUP, record: group };
}

export async function joinGroup(request, source, record) {
  const actorId = String(request.user.id);
  if (source === GROUP_SOURCE.DEPARTMENT) {
    const membership = await findDepartmentMembership(record.id, actorId);
    if (membership) return { status: 'already_member', group: buildGroupPayload(record) };
    await createDepartmentMembership(record.id, actorId, 'MEMBER');
    return { status: 'joined', group: buildGroupPayload(record) };
  }
  const membership = await findBibleStudyMembership(record.id, actorId);
  if (membership) return { status: 'already_member', group: buildGroupPayload(record) };
  await createBibleStudyMembership(record.id, actorId, 'MEMBER');
  return { status: 'joined', group: buildGroupPayload(record) };
}

export async function createPendingJoinRequest(request, source, record) {
  const actorId = String(request.user.id);
  if (source === GROUP_SOURCE.DEPARTMENT) {
    const result = await pool.query(
      `INSERT INTO member_join_requests (department_id, user_id, source, status)
       VALUES ($1, $2, 'department', 'PENDING') RETURNING id`, [record.id, actorId],
    );
    return { status: 'pending', group: buildGroupPayload(record), requestId: result.rows[0].id };
  }
  const result = await pool.query(
    `INSERT INTO member_join_requests (group_id, user_id, source, status)
     VALUES ($1, $2, 'bible_study_group', 'PENDING') RETURNING id`, [record.id, actorId],
  );
  return { status: 'pending', group: buildGroupPayload(record), requestId: result.rows[0].id };
}

export async function listPublicDepartments() {
  const result = await pool.query(
    `SELECT d.id, d.name, d.description, d.visibility, d.enrollment_open, d.requires_approval, d.capacity,
      o.name AS "organizationName", u.name AS "leaderName",
      d.group_email AS "groupEmail", d.location_text AS "locationText",
      d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
      d.telegram_type AS "telegramType", d.telegram_username AS "telegramUsername",
      d.telegram_public_link AS "telegramPublicLink", d.telegram_invite_link AS "telegramInviteLink",
      d.telegram_connection_status AS "telegramConnectionStatus", d.created_at AS "createdAt", d.updated_at AS "updatedAt"
     FROM departments d
     LEFT JOIN organizations o ON o.id = d.organization_id
     LEFT JOIN users u ON u.id = d.leader_user_id
     WHERE d.is_public = TRUE AND d.is_active = TRUE AND d.deleted_at IS NULL
     ORDER BY d.name`, []);
  return result.rows;
}

function findPendingJoinRequest(departmentId, userId, groupId, actorId) {
  let result;
  if (departmentId !== null) {
    result = pool.query(
      `SELECT id, department_id AS group_id, source FROM member_join_requests
       WHERE department_id = $1 AND user_id = $2 AND status = 'PENDING'`,
      [departmentId, userId],
    );
  } else {
    result = pool.query(
      `SELECT id, group_id, source FROM member_join_requests
       WHERE group_id = $1 AND user_id = $2 AND status = 'PENDING'`,
      [groupId, actorId],
    );
  }
  return result.then((r) => r.rows[0] ?? null);
}

function findDepartmentMembership(departmentId, userId) {
  return pool.query(
    `SELECT u.name, dm.role FROM department_members dm
     JOIN users u ON u.id = dm.user_id
     WHERE dm.department_id = $1 AND dm.user_id = $2 AND dm.status = 'ACTIVE'`,
    [departmentId, userId],
  ).then((r) => r.rows[0] ?? null);
}

function findBibleStudyMembership(groupId, userId) {
  return pool.query(
    `SELECT u.name, bsm.role FROM bible_study_memberships bsm
     JOIN users u ON u.id = bsm.user_id
     WHERE bsm.bible_study_group_id = $1 AND bsm.user_id = $2 AND bsm.deleted_at IS NULL`,
    [groupId, userId],
  ).then((r) => r.rows[0] ?? null);
}

function createDepartmentMembership(departmentId, userId, role = 'MEMBER') {
  return pool.query(
    `INSERT INTO department_members (department_id, user_id, role, created_by)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [departmentId, userId, role, userId],
  );
}

function createBibleStudyMembership(groupId, userId, role = 'MEMBER') {
  return pool.query(
    `INSERT INTO bible_study_memberships (bible_study_group_id, user_id, role, created_by)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [groupId, userId, role, userId],
  );
}

function validateGroupJoin(group) {
  if (group.visibility === 'private' || group.visibility === 'invitation_only') {
    throw Object.assign(new Error('This group is private. A leader must approve your membership before you can join.'), { status: 403 });
  }
  if (group.is_active !== true) {
    throw Object.assign(new Error('This group is no longer active.'), { status: 410 });
  }
  if (!group.enrollment_open) {
    throw Object.assign(new Error('Joining this group is currently closed. Please check back soon or contact a leader.'), { status: 409 });
  }
}

function validateDepartmentJoin(department) {
  if (department.visibility === 'private' || department.visibility === 'invitation_only') {
    throw Object.assign(new Error('This department is private. A leader must approve your membership before you can join.'), { status: 403 });
  }
  if (department.is_active !== true || department.deleted_at !== null) {
    throw Object.assign(new Error('This department is no longer active.'), { status: 410 });
  }
  if (!department.enrollment_open) {
    throw Object.assign(new Error('Joining this department is currently closed. Please check back soon or contact a leader.'), { status: 409 });
  }
}
