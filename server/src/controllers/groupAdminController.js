import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { requestError, requiredString } from '../utils/http.js';

const groupTables = {
  department: {
    table: 'departments',
    membershipTable: 'department_members',
    membershipGroupColumn: 'department_id',
    entityType: 'department',
  },
  bible_study_group: {
    table: 'bible_study_groups',
    membershipTable: 'bible_study_memberships',
    membershipGroupColumn: 'bible_study_group_id',
    entityType: 'bible_study_group',
  },
};

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function optionalText(value, label, max) {
  if (value == null || value === '') return null;
  return requiredString(value, label, max);
}

function optionalHttpsUrl(value, label, allowedHosts) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2000) throw fail(`${label} must be a valid HTTPS URL.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw fail(`${label} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase()))) {
    throw fail(`${label} must use an approved HTTPS address.`);
  }
  return url.toString();
}

function telegramFields(body) {
  const type = String(body.telegramType ?? 'none').toLowerCase();
  if (!['none', 'group', 'channel'].includes(type)) throw fail('Telegram destination type is invalid.');
  if (type === 'none') return { type, username: null, publicLink: null, inviteLink: null };
  const username = optionalText(body.telegramUsername, 'Telegram username', 64);
  if (username && !/^@?[A-Za-z0-9_]{5,32}$/.test(username)) throw fail('Enter a valid Telegram username.');
  const publicLink = optionalHttpsUrl(body.telegramPublicLink, 'Telegram public link', ['t.me', 'www.t.me']);
  const inviteLink = optionalHttpsUrl(body.telegramInviteLink, 'Telegram invitation link', ['t.me', 'www.t.me']);
  if (!username && !publicLink && !inviteLink) throw fail('Add a Telegram username or link, or choose "Not connected".');
  return { type, username, publicLink, inviteLink };
}

function communityLinks(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) throw fail('Provide no more than 20 official group links.');
  const allowed = new Set(['telegram', 'facebook', 'youtube']);
  return value.map((link) => {
    const platform = typeof link?.platform === 'string' ? link.platform.toLowerCase() : '';
    if (!allowed.has(platform)) throw fail('Only Telegram, Facebook, and YouTube group links are supported.');
    const url = optionalHttpsUrl(link.url, 'Group link');
    if (!url) throw fail('Every group link requires a URL.');
    if (platform === 'telegram' && !['t.me', 'www.t.me'].includes(new URL(url).hostname.toLowerCase())) {
      throw fail('Telegram group links must use t.me.');
    }
    return {
      platform,
      label: optionalText(link.label, 'Link label', 80) || platform,
      url,
      enabled: link.enabled !== false,
    };
  });
}

async function resolveLeader(client, value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw fail('Select a registered member or staff account.');
  const user = await client.query(
    `SELECT id, name FROM users
     WHERE id=$1 AND account_status='ACTIVE' AND deleted_at IS NULL`,
    [id],
  );
  if (!user.rowCount) throw fail('The selected leader account is not active or no longer exists.');
  return user.rows[0];
}

async function syncLeaderMembership(client, groupType, groupId, previousLeaderId, nextLeader) {
  const config = groupTables[groupType];
  if (previousLeaderId && String(previousLeaderId) !== String(nextLeader?.id ?? '')) {
    await client.query(
      `UPDATE ${config.membershipTable} SET role='MEMBER'
       WHERE ${config.membershipGroupColumn}=$1 AND user_id=$2 AND UPPER(role)='LEADER'`,
      [groupId, previousLeaderId],
    );
  }
  if (nextLeader) {
    const existingMembership = await client.query(
      `UPDATE ${config.membershipTable}
       SET role='LEADER',status='ACTIVE'
       WHERE ${config.membershipGroupColumn}=$1 AND user_id=$2`,
      [groupId, nextLeader.id],
    );
    if (!existingMembership.rowCount) {
      await client.query(
        `INSERT INTO ${config.membershipTable}(user_id,${config.membershipGroupColumn},role,status)
         VALUES($1,$2,'LEADER','ACTIVE')`,
        [nextLeader.id, groupId],
      );
    }
  }
}

export async function listGroupLeaderCandidates(request, response) {
  try {
    const search = typeof request.query?.search === 'string' ? request.query.search.trim().slice(0, 100) : '';
    const result = await pool.query(
      `SELECT id::text AS id,name,role
       FROM users
       WHERE account_status='ACTIVE' AND deleted_at IS NULL
         AND ($1 = '' OR name ILIKE '%' || $1 || '%')
       ORDER BY LOWER(name),id
       LIMIT 100`,
      [search],
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return requestError(error, response);
  }
}

function prepareGroupUpdate(groupType, body) {
  const name = requiredString(body.name, groupType === 'department' ? 'Department name' : 'Group name', 160);
  const telegram = telegramFields(body);
  const links = communityLinks(body.communityLinks);
  const isActive = body.isActive !== false;

  if (groupType === 'department') {
    const visibility = String(body.visibility ?? 'PUBLIC').toUpperCase();
    if (!['PUBLIC', 'PRIVATE'].includes(visibility)) throw fail('Visibility must be PUBLIC or PRIVATE.');
    return {
      name,
      description: optionalText(body.description, 'Description', 5000),
      category: optionalText(body.category, 'Category', 100),
      logo: optionalHttpsUrl(body.logoUrl, 'Logo URL'),
      banner: optionalHttpsUrl(body.bannerUrl, 'Banner URL'),
      location: optionalText(body.meetingLocation, 'Meeting location', 500),
      schedule: optionalText(body.meetingSchedule, 'Meeting schedule', 500),
      organizationId: body.organizationId ? Number(body.organizationId) : null,
      visibility,
      isActive,
      telegram,
      links,
      leaderUserId: body.leaderUserId || null,
    };
  }

  const capacity = body.capacity == null || body.capacity === '' ? null : Number(body.capacity);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)) {
    throw fail('Maximum members must be a positive whole number.');
  }
  const isPublic = body.isPublic !== false;
  const mapsLink = optionalHttpsUrl(body.googleMapsLink, 'Google Maps link', ['maps.google.com', 'maps.app.goo.gl', 'www.google.com']);
  if (mapsLink && new URL(mapsLink).hostname === 'www.google.com' && !new URL(mapsLink).pathname.startsWith('/maps')) {
    throw fail('Provide a Google Maps link.');
  }
  return {
    name,
    description: optionalText(body.description, 'Description', 5000),
    location: optionalText(body.locationText, 'Meeting location', 500),
    schedule: optionalText(body.meetingSchedule, 'Meeting schedule', 500),
    currentStudy: optionalText(body.currentStudy, 'Current study', 500),
    groupEmail: optionalText(body.groupEmail, 'Group email', 320),
    mapsLink,
    capacity,
    logo: optionalHttpsUrl(body.groupProfileImage, 'Profile image URL'),
    banner: optionalHttpsUrl(body.bannerImage, 'Banner image URL'),
    visibility: isPublic ? 'public' : 'private',
    isPublic,
    isActive,
    telegram,
    links,
    leaderUserId: body.leaderUserId || null,
  };
}

export async function updateManagedGroup(request, response) {
  const groupType = request.params.type
    || (request.path.startsWith('/departments/') ? 'department' : 'bible_study_group');
  const config = groupTables[groupType];
  const id = Number(request.params.id);
  if (!config || !Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'A valid group type and ID are required.' });

  const client = await pool.connect();
  try {
    const fields = prepareGroupUpdate(groupType, request.body ?? {});
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id,leader_user_id AS "leaderUserId" FROM ${config.table}
       WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    if (!existing.rowCount) {
      await client.query('ROLLBACK');
      return response.status(404).json({ error: 'Group was not found.' });
    }
    const leader = await resolveLeader(client, fields.leaderUserId);
    let result;
    if (groupType === 'department') {
      result = await client.query(
        `UPDATE departments SET name=$2,description=$3,category=$4,logo_url=$5,banner_url=$6,
          meeting_location=$7,meeting_schedule=$8,organization_id=$9,visibility=$10,is_active=$11,
          leader_user_id=$12,leader_name=$13,telegram_type=$14,telegram_username=$15,
          telegram_public_link=$16,telegram_invite_link=$17,community_links=$18::jsonb,updated_at=NOW()
         WHERE id=$1
         RETURNING id,name,description,category,logo_url AS "logoUrl",banner_url AS "bannerUrl",
          meeting_location AS "meetingLocation",meeting_schedule AS "meetingSchedule",visibility,
          is_active AS "isActive",leader_user_id AS "leaderUserId",leader_name AS "leaderName",
          telegram_type AS "telegramType",telegram_username AS "telegramUsername",
          telegram_public_link AS "telegramPublicLink",telegram_invite_link AS "telegramInviteLink",
          community_links AS "communityLinks"`,
        [id, fields.name, fields.description, fields.category, fields.logo, fields.banner, fields.location,
          fields.schedule, fields.organizationId, fields.visibility, fields.isActive, leader?.id ?? null,
          leader?.name ?? null, fields.telegram.type, fields.telegram.username, fields.telegram.publicLink,
          fields.telegram.inviteLink, JSON.stringify(fields.links)],
      );
    } else {
      result = await client.query(
        `UPDATE bible_study_groups SET name=$2,description=$3,location_text=$4,meeting_schedule=$5,
          current_study=$6,group_email=$7,google_maps_link=$8,capacity=$9,group_profile_image=$10,
          banner_image=$11,visibility=$12,is_public=$13,is_active=$14,leader_user_id=$15,leader_name=$16,
          telegram_type=$17,telegram_username=$18,telegram_public_link=$19,telegram_invite_link=$20,
          community_links=$21::jsonb,updated_at=NOW()
         WHERE id=$1
         RETURNING id,name,description,location_text AS "locationText",meeting_schedule AS "meetingSchedule",
          current_study AS "currentStudy",group_email AS "groupEmail",google_maps_link AS "googleMapsLink",
          capacity,group_profile_image AS "groupProfileImage",banner_image AS "bannerImage",visibility,
          is_public AS "isPublic",is_active AS "isActive",leader_user_id AS "leaderUserId",
          leader_name AS "leaderName",telegram_type AS "telegramType",telegram_username AS "telegramUsername",
          telegram_public_link AS "telegramPublicLink",telegram_invite_link AS "telegramInviteLink",
          community_links AS "communityLinks"`,
        [id, fields.name, fields.description, fields.location, fields.schedule, fields.currentStudy,
          fields.groupEmail, fields.mapsLink, fields.capacity, fields.logo, fields.banner, fields.visibility,
          fields.isPublic, fields.isActive, leader?.id ?? null, leader?.name ?? null, fields.telegram.type,
          fields.telegram.username, fields.telegram.publicLink, fields.telegram.inviteLink,
          JSON.stringify(fields.links)],
      );
    }
    await syncLeaderMembership(client, groupType, id, existing.rows[0].leaderUserId, leader);
    await client.query('COMMIT');
    await audit({ actorUserId: request.user.id, action: `${groupType.toUpperCase()}_UPDATED`, entityType: config.entityType, entityId: id, after: result.rows[0], ipAddress: clientIp(request) });
    return response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return requestError(error, response);
  } finally {
    client.release();
  }
}

export async function deleteManagedGroup(request, response) {
  const groupType = request.params.type
    || (request.path.startsWith('/departments/') ? 'department' : 'bible_study_group');
  const config = groupTables[groupType];
  const id = Number(request.params.id);
  if (!config || !Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'A valid group type and ID are required.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id,name FROM ${config.table} WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    if (!existing.rowCount) {
      await client.query('ROLLBACK');
      return response.status(404).json({ error: 'Group was not found.' });
    }

    const label = existing.rows[0].name;
    await client.query(
      `DELETE FROM group_notification_deliveries WHERE group_id=$1 AND group_type=$2`,
      [id, groupType],
    );
    await client.query(
      `DELETE FROM group_telegram_test_deliveries WHERE group_id=$1 AND group_type=$2`,
      [id, groupType],
    );
    await client.query(`DELETE FROM group_notification_preferences WHERE group_id=$1 AND group_type=$2`, [id, groupType]);
    await client.query(`DELETE FROM group_follows WHERE group_id=$1 AND group_type=$2`, [id, groupType]);
    await client.query(`DELETE FROM group_posts WHERE group_id=$1 AND group_type=$2`, [id, groupType]);
    if (groupType === 'department') {
      await client.query(
        `DELETE FROM events
         WHERE audience_group_id=$1 AND audience_group_type=$2
           AND (audience_department_id IS NULL OR audience_department_id=$1) AND deleted_at IS NULL`,
        [id, groupType],
      );
      await client.query(
        `UPDATE events SET audience_group_id=NULL,audience_group_type=NULL
         WHERE audience_group_id=$1 AND audience_group_type=$2`,
        [id, groupType],
      );
    } else {
      await client.query(
        `DELETE FROM events
         WHERE audience_group_id=$1 AND audience_group_type=$2
           AND audience_department_id IS NULL AND deleted_at IS NULL`,
        [id, groupType],
      );
      await client.query(
        `UPDATE events SET audience_group_id=NULL,audience_group_type=NULL
         WHERE audience_group_id=$1 AND audience_group_type=$2`,
        [id, groupType],
      );
      await client.query(
        `UPDATE announcements SET bible_study_group_id=NULL
         WHERE bible_study_group_id=$1 AND department_id IS NOT NULL`,
        [id],
      );
    }

    if (groupType === 'department') {
      await client.query(
        `DELETE FROM events
         WHERE audience_department_id=$1 AND audience_group_id IS NULL AND deleted_at IS NULL`,
        [id],
      );
      await client.query(
        `UPDATE events SET audience_department_id=NULL WHERE audience_department_id=$1`,
        [id],
      );
      await client.query(
        `UPDATE announcements SET department_id=NULL
         WHERE department_id=$1 AND bible_study_group_id IS NOT NULL`,
        [id],
      );
      await client.query(
        `UPDATE events SET program_id=NULL
         WHERE program_id IN (SELECT id FROM programs WHERE department_id=$1)`,
        [id],
      );
      await client.query(`DELETE FROM programs WHERE department_id=$1`, [id]);
    }
    await client.query(`DELETE FROM ${config.table} WHERE id=$1`, [id]);
    await client.query('COMMIT');
    await audit({
      actorUserId: request.user.id,
      action: `${groupType.toUpperCase()}_PERMANENTLY_DELETED`,
      entityType: config.entityType,
      entityId: id,
      before: { id, name: label },
      ipAddress: clientIp(request),
    });
    return response.status(200).json({ success: true, message: `${label} and its group-only records were permanently deleted.` });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23503') {
      return response.status(409).json({
        error: 'Deletion was blocked because a dependent record is protected. No data was deleted; resolve the dependency before trying again.',
      });
    }
    return requestError(error, response);
  } finally {
    client.release();
  }
}

export async function setManagedDepartmentStatus(request, response) {
  return setManagedGroupStatus(request, response, 'department');
}

export async function setManagedBibleStudyGroupStatus(request, response) {
  return setManagedGroupStatus(request, response, 'bible_study_group');
}

async function setManagedGroupStatus(request, response, groupType) {
  const config = groupTables[groupType];
  const id = Number(request.params.id);
  if (!Number.isSafeInteger(id) || id < 1 || typeof request.body?.isActive !== 'boolean') {
    return response.status(400).json({ error: 'Provide a valid group ID and active status.' });
  }
  try {
    const result = await pool.query(
      `UPDATE ${config.table}
       SET is_active=$2,updated_at=NOW()
       WHERE id=$1 AND deleted_at IS NULL
       RETURNING id,name,is_active AS "isActive"`,
      [id, request.body.isActive],
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Group was not found.' });
    await audit({
      actorUserId: request.user.id,
      action: `${groupType.toUpperCase()}_STATUS_UPDATED`,
      entityType: config.entityType,
      entityId: id,
      after: result.rows[0],
      ipAddress: clientIp(request),
    });
    return response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return requestError(error, response);
  }
}
