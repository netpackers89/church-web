import { pool } from '../config/db.js';
import { queueGroupPostNotifications } from '../services/groupNotificationService.js';
import { requestError } from '../utils/http.js';
import { isSafeImageUrl, uploadImageToImgbb } from '../services/imgbbService.js';
import { config } from '../config/env.js';
import { sendTelegramNotification } from '../telegram/services/messaging.js';
import { sendEmailNotification } from '../email/index.js';
import { publishGroupPostToTelegram, setGroupTelegramConnectionStatus, telegramGroupDestination } from '../services/groupTelegramPublishing.js';

export { telegramGroupDestination };

const GROUP_TYPES = new Set(['department', 'bible_study_group']);
const MAX_PAGE_SIZE = 30;

function groupType(request) {
  const type = request.query.type;
  return GROUP_TYPES.has(type) ? type : null;
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function globalManager(user) {
  const roles = new Set((user?.roles ?? []).map((role) => String(role).toUpperCase()));
  const permissions = new Set(user?.permissions ?? []);
  return ['SYSTEM_OWNER', 'ADMIN', 'PASTOR'].some((role) => roles.has(role))
    || permissions.has('system.owner.manage');
}

async function managerAccess(request, response) {
  const type = groupType(request);
  const id = validId(request.params.id);
  if (!type || !id) {
    response.status(400).json({ error: 'A valid group id and type are required.' });
    return null;
  }
  const isGlobalManager = globalManager(request.user);
  const sql = type === 'department'
    ? `SELECT d.id, d.name, d.description, d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
              d.meeting_location AS "locationText", d.meeting_schedule AS "meetingSchedule",
              d.leader_user_id AS "leaderUserId", d.leader_name AS "leaderName", d.is_active AS "isActive",
              d.community_links AS "communityLinks", d.telegram_public_link AS "telegramPublicLink",
              d.telegram_invite_link AS "telegramInviteLink", d.telegram_username AS "telegramUsername",
              d.telegram_type AS "telegramType",d.telegram_connection_status AS "telegramConnectionStatus"
       FROM departments d LEFT JOIN department_members dm ON dm.department_id=d.id
       WHERE d.id=$1 AND d.deleted_at IS NULL AND ($3::boolean OR d.leader_user_id=$2 OR (dm.user_id=$2 AND dm.status='ACTIVE' AND UPPER(dm.role) IN ('LEADER','MANAGER')))
       LIMIT 1`
    : `SELECT g.id, g.name, g.description, g.group_profile_image AS "logoUrl", g.banner_image AS "bannerUrl",
              g.location_text AS "locationText", g.meeting_schedule AS "meetingSchedule", g.current_study AS "currentStudy",
              g.leader_user_id AS "leaderUserId", g.leader_name AS "leaderName", g.is_active AS "isActive",
              g.community_links AS "communityLinks", g.telegram_public_link AS "telegramPublicLink",
              g.telegram_invite_link AS "telegramInviteLink", g.telegram_username AS "telegramUsername",
              g.telegram_type AS "telegramType",g.telegram_connection_status AS "telegramConnectionStatus"
       FROM bible_study_groups g LEFT JOIN bible_study_memberships bm ON bm.bible_study_group_id=g.id
       WHERE g.id=$1 AND g.deleted_at IS NULL AND ($3::boolean OR g.leader_user_id=$2 OR (bm.user_id=$2 AND bm.status='ACTIVE' AND UPPER(bm.role) IN ('LEADER','MANAGER')))
       LIMIT 1`;
  try {
    const result = await pool.query(sql, [id, request.user.id, isGlobalManager]);
    if (!result.rowCount) {
      response.status(403).json({ error: 'You can manage only groups assigned to your account.' });
      return null;
    }

    return { type, id, group: result.rows[0] };
  } catch (error) {
    requestError(error, response);
    return null;
  }
}

export async function testManagedGroupCommunication(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  if (request.body?.confirm !== true) {
    return response.status(400).json({ error: 'Confirm that you want to send a real communication test.' });
  }
  const channel = request.body?.channel;
  if (!['email', 'telegram'].includes(channel)) return response.status(400).json({ error: 'channel must be email or telegram.' });
  let telegramTestId;
  try {
    if (channel === 'email') {
      const result = await pool.query('SELECT name,email FROM users WHERE id=$1 AND account_status=$2', [request.user.id, 'ACTIVE']);
      if (!result.rowCount || !result.rows[0].email) return response.status(409).json({ error: 'Add an email address to your account before testing email delivery.' });
      const manager = result.rows[0];
      await sendEmailNotification({
        to: manager.email,
        subject: `[TEST] ${access.group.name} email delivery`,
        text: `[TEST — please ignore] ${config.branding.churchName} email delivery for ${access.group.name} is working. This test was requested by ${manager.name || 'you'}.`,
      });
      return response.json({ success: true, data: { channel, destination: manager.email }, message: `Test email sent to ${manager.email}.` });
    }

    const destination = telegramGroupDestination(access.group);
    if (!destination) {
      const message = 'A public Telegram group or channel username is required.';
      const delivery = await pool.query(
        `INSERT INTO group_telegram_test_deliveries(group_id,group_type,requested_by,destination,status,error_message)
         VALUES($1,$2,$3,'not-configured','FAILED',$4) RETURNING id`,
        [access.id, access.type, request.user.id, message],
      );
      telegramTestId = delivery.rows[0]?.id;
      await setGroupTelegramConnectionStatus(access.type, access.id, false, 'A public Telegram group or channel username is required.');
      return response.status(409).json({
        data: { channel, status: 'FAILED', deliveryId: telegramTestId ?? null },
        error: 'A public Telegram group or channel username is required. Invite-only Telegram links cannot be used as bot message destinations.',
      });
    }
    const delivery = await pool.query(
      `INSERT INTO group_telegram_test_deliveries(group_id,group_type,requested_by,destination)
       VALUES($1,$2,$3,$4) RETURNING id`,
      [access.id, access.type, request.user.id, destination.chatId],
    );
    telegramTestId = delivery.rows[0].id;
    const result = await sendTelegramNotification({
      chatId: destination.chatId,
      text: `[TEST — please ignore] ${config.branding.churchName} is testing Telegram delivery for ${access.group.name}.`,
      buttons: [{ text: 'Open Telegram group', url: destination.url }],
    });
    await pool.query(
      `UPDATE group_telegram_test_deliveries
       SET status='SENT',telegram_message_id=$2,updated_at=NOW() WHERE id=$1`,
      [telegramTestId, result.messageId],
    );
    await setGroupTelegramConnectionStatus(access.type, access.id, true);
    return response.json({ success: true, data: { channel, destination: destination.chatId, status: 'SENT', deliveryId: telegramTestId }, message: `Test message delivered to ${destination.chatId}.` });
  } catch (error) {
    if (channel === 'telegram') {
      if (telegramTestId) {
        await pool.query(
          `UPDATE group_telegram_test_deliveries SET status='FAILED',error_message=$2,updated_at=NOW() WHERE id=$1`,
          [telegramTestId, error.message.slice(0, 1000)],
        );
      }
      await setGroupTelegramConnectionStatus(access.type, access.id, false, error.message);
    }
    console.error(`[group communications] ${channel} test failed:`, error.message);
    return response.status(502).json({
      error: channel === 'telegram'
        ? 'Telegram did not deliver the test. Check that the church bot is an administrator of this group or channel, then try again.'
        : 'The email provider could not deliver the test. Check the email address on your account and try again.',
    });
  }
}

async function requireVisiblePost(request, response) {
  const id = validId(request.params.postId);
  const type = groupType(request);
  const groupId = validId(request.params.id);
  if (!id || !type || !groupId) {
    response.status(400).json({ error: 'A valid group and post are required.' });
    return null;
  }
  try {
    const result = await pool.query(
      `SELECT p.id, p.group_id AS "groupId", p.group_type AS "groupType", p.title,
              p.body, p.image_url AS "imageUrl", p.image_urls AS "imageUrls",
              p.category, p.status, p.published_at AS "publishedAt", p.published_by AS "publishedBy",
              p.is_pinned AS "isPinned", p.created_at AS "createdAt", p.updated_at AS "updatedAt"
       FROM group_posts p
       WHERE p.id=$1 AND p.group_id=$2 AND p.group_type=$3 AND p.deleted_at IS NULL
         AND p.status='PUBLISHED' AND p.published_at <= NOW()`, [id, groupId, type]
    );
    if (!result.rowCount) {
      response.status(404).json({ error: 'Post was not found.' });
      return null;
    }
    return result.rows[0];
  } catch (error) {
    requestError(error, response);
    return null;
  }
}

async function notifyGroupFollowers(post, group, groupType) {
  const followers = await pool.query(
    `SELECT gf.user_id,u.email,u.telegram_chat_id,u.notify_email,u.notify_telegram,
            gnp.email_enabled,gnp.telegram_enabled,gnp.in_app_enabled
     FROM group_follows gf JOIN users u ON u.id=gf.user_id
     LEFT JOIN group_notification_preferences gnp ON gnp.user_id=gf.user_id AND gnp.group_id=gf.group_id AND gnp.group_type=gf.group_type
     WHERE gf.group_id=$1 AND gf.group_type=$2`, [group.id, groupType]
  );
  return queueGroupPostNotifications({
    post, group: { ...group, id: group.id, group_type: groupType }, followersWithPrefs: followers.rows,
    churchName: config.branding.churchName,
    churchContact: [config.branding.email, config.branding.phone].filter(Boolean).join(' · '),
    churchSocialLinks: [config.branding.websiteUrl && { label: 'Website', url: config.branding.websiteUrl }, config.branding.telegramUrl && { label: 'Telegram', url: config.branding.telegramUrl }].filter(Boolean),
  });
}

export async function listGroupPosts(request, response) {
  const id = validId(request.params.id);
  const type = groupType(request);
  if (!id || !type) return response.status(400).json({ error: 'A valid group id and type are required.' });
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(request.query.limit, 10) || 12));
  const before = request.query.before ? new Date(request.query.before) : null;
  if (before && !Number.isFinite(before.getTime())) return response.status(400).json({ error: 'Invalid post cursor.' });
  try {
    const values = [id, type, limit + 1];
    let cursorSql = '';
    if (before) {
      values.push(before.toISOString());
      cursorSql = 'AND p.published_at < $4';
    }
    const result = await pool.query(
      `SELECT p.id, p.title, p.body, p.image_url AS "imageUrl", p.image_urls AS "imageUrls",
              p.category, p.published_by AS "publishedBy", p.published_at AS "publishedAt",
              p.created_at AS "createdAt", p.updated_at AS "updatedAt", p.is_pinned AS "isPinned",
              u.name AS "authorName", u.profile_image_url AS "authorImageUrl",
              (SELECT COUNT(*)::int FROM group_post_likes l WHERE l.post_id=p.id) AS "likeCount",
              (SELECT COUNT(*)::int FROM group_post_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL AND c.hidden_at IS NULL) AS "commentCount",
              EXISTS(SELECT 1 FROM group_post_likes mine WHERE mine.post_id=p.id AND mine.user_id=$${before ? 5 : 4}) AS "likedByMe"
       FROM group_posts p JOIN users u ON u.id=p.published_by
       WHERE p.group_id=$1 AND p.group_type=$2 AND p.deleted_at IS NULL
         AND p.status='PUBLISHED' AND p.published_at <= NOW() ${cursorSql}
       ORDER BY p.is_pinned DESC, p.published_at DESC, p.id DESC LIMIT $3`,
      before ? [...values, request.user?.id ?? null] : [...values, request.user?.id ?? null]
    );
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit);
    return response.json({ success: true, data: items, pagination: { hasMore, nextCursor: hasMore ? items.at(-1)?.publishedAt : null } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listGroupPrograms(request, response) {
  const id = validId(request.params.id);
  const type = groupType(request);
  if (!id || !type) return response.status(400).json({ error: 'A valid group id and type are required.' });
  try {
    const groupTable = type === 'department' ? 'departments' : 'bible_study_groups';
    const visibility = type === 'department' ? "visibility='PUBLIC'" : "is_public=TRUE AND visibility='public'";
    const group = await pool.query(`SELECT id FROM ${groupTable} WHERE id=$1 AND is_active=TRUE AND deleted_at IS NULL AND ${visibility}`, [id]);
    if (!group.rowCount) return response.status(404).json({ error: 'Group was not found.' });
    const result = await pool.query(
      `SELECT id,title,description,location_text AS "locationText",starts_at AS "startsAt",ends_at AS "endsAt",
              capacity,image_url AS "imageUrl",status
       FROM events WHERE deleted_at IS NULL AND status='PUBLISHED' AND starts_at >= NOW()
         AND ((audience_group_id=$1 AND audience_group_type=$2) OR ($2='department' AND audience_department_id=$1))
       ORDER BY starts_at LIMIT 50`, [id, type]
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) { return requestError(error, response); }
}

export async function createGroupProgram(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  const { title, description, locationText, startsAt, endsAt, capacity, imageUrl } = request.body ?? {};
  const idempotencyKey = typeof request.body?.idempotencyKey === 'string' ? request.body.idempotencyKey.trim() : '';
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  const places = capacity === '' || capacity == null ? null : Number(capacity);
  if (!idempotencyKey || idempotencyKey.length > 100 || !cleanTitle || cleanTitle.length > 200
    || !start || !Number.isFinite(start.valueOf()) || (end && (!Number.isFinite(end.valueOf()) || end <= start))
    || (places !== null && (!Number.isInteger(places) || places < 1 || places > 100000))
    || (imageUrl !== undefined && imageUrl !== null && (typeof imageUrl !== 'string' || imageUrl.length > 2048 || !isSafeImageUrl(imageUrl, config.mediaAllowedHosts)))) {
    return response.status(400).json({ error: 'Provide a title, valid start time, optional later end time, and valid capacity.' });
  }
  let client;
  let event;
  let noticePost;
  let created = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const program = await client.query(
      `INSERT INTO events(title,description,location_text,starts_at,ends_at,capacity,status,image_url,
          audience_department_id,audience_group_id,audience_group_type,created_by,notify_members,notify_all_members,idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6,'PUBLISHED',$7,$8,$9,$10,$11,FALSE,FALSE,$12)
       ON CONFLICT (created_by,audience_group_type,audience_group_id,idempotency_key)
         WHERE idempotency_key IS NOT NULL AND audience_group_type IS NOT NULL AND audience_group_id IS NOT NULL
       DO NOTHING
       RETURNING id,title,description,location_text AS "locationText",starts_at AS "startsAt",ends_at AS "endsAt",capacity,status,image_url AS "imageUrl"`,
      [cleanTitle, typeof description === 'string' ? description.trim().slice(0, 12000) : null,
        typeof locationText === 'string' ? locationText.trim().slice(0, 500) : null, start.toISOString(), end?.toISOString() ?? null,
        places, imageUrl || null, access.type === 'department' ? access.id : null, access.id, access.type, request.user.id, idempotencyKey]
    );
    if (program.rowCount) {
      created = true;
      [event] = program.rows;
    } else {
      const existing = await client.query(
        `SELECT id,title,description,location_text AS "locationText",starts_at AS "startsAt",ends_at AS "endsAt",
                capacity,status,image_url AS "imageUrl"
         FROM events WHERE created_by=$1 AND audience_group_type=$2 AND audience_group_id=$3 AND idempotency_key=$4`,
        [request.user.id, access.type, access.id, idempotencyKey],
      );
      [event] = existing.rows;
    }
    const postBody = [
      event.description,
      `When: ${new Date(event.startsAt).toLocaleString()}`,
      event.locationText ? `Where: ${event.locationText}` : null,
      `Details: ${new URL(`/events/${event.id}`, config.webOrigin).href}`,
    ].filter(Boolean).join('\n\n');
    const postResult = await client.query(
      `INSERT INTO group_posts(group_id,group_type,title,body,image_url,category,status,published_by,published_at,idempotency_key)
       VALUES($1,$2,$3,$4,$5,'EVENT','PUBLISHED',$6,NOW(),$7)
       ON CONFLICT (group_type,group_id,published_by,idempotency_key)
         WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING id,group_id AS "groupId",group_type AS "groupType",title,body,image_url AS "imageUrl",
                 category,status,published_at AS "publishedAt",published_by AS "publishedBy"`,
      [access.id, access.type, event.title, postBody, event.imageUrl, request.user.id, `event-${event.id}`],
    );
    if (postResult.rowCount) [noticePost] = postResult.rows;
    else {
      const existingPost = await client.query(
        `SELECT id,group_id AS "groupId",group_type AS "groupType",title,body,image_url AS "imageUrl",
                category,status,published_at AS "publishedAt",published_by AS "publishedBy"
         FROM group_posts WHERE group_id=$1 AND group_type=$2 AND published_by=$3 AND idempotency_key=$4`,
        [access.id, access.type, request.user.id, `event-${event.id}`],
      );
      [noticePost] = existingPost.rows;
    }
    await client.query('COMMIT');
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[group program] transaction rollback failed:', rollbackError.message);
      }
    }
    return requestError(error, response);
  } finally {
    client?.release();
  }

  let telegramDelivery;
  if (created) {
    telegramDelivery = await publishGroupPostToTelegram({
      post: noticePost,
      group: { ...access.group, id: access.id },
      groupType: access.type,
      viewUrl: new URL(`/events/${event.id}`, config.webOrigin).href,
      viewLabel: 'View program',
    });
    notifyGroupFollowers(noticePost, { ...access.group, id: access.id }, access.type)
      .catch((error) => console.error('[group program] notifications failed:', error.message));
  }
  return response.status(created ? 201 : 200).json({
    success: true,
    data: { ...event, telegramDelivery },
  });
}

export async function createGroupPost(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  const { title, body, imageUrl, imageUrls = [], category = 'UPDATE', status = 'PUBLISHED', scheduledAt } = request.body ?? {};
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const cleanBody = typeof body === 'string' ? body.trim() : '';
  const images = Array.isArray(imageUrls) ? imageUrls.slice(0, 8) : [];
  const idempotencyKey = typeof request.body?.idempotencyKey === 'string' ? request.body.idempotencyKey.trim() : '';
  const allowedCategory = ['UPDATE', 'ANNOUNCEMENT', 'DEVOTIONAL', 'STORY', 'EVENT'].includes(category) ? category : null;
  const allowedStatus = ['DRAFT', 'SCHEDULED', 'PUBLISHED'].includes(status) ? status : null;
  const schedule = scheduledAt ? new Date(scheduledAt) : null;
  if (!idempotencyKey || idempotencyKey.length > 100 || !cleanTitle || cleanTitle.length > 200 || !cleanBody || cleanBody.length > 12000 || !allowedCategory || !allowedStatus) {
    return response.status(400).json({ error: 'Add a title, post content, and valid post category.' });
  }
  if (images.some((url) => typeof url !== 'string' || url.length > 2048 || !isSafeImageUrl(url, config.mediaAllowedHosts))
    || (imageUrl && (typeof imageUrl !== 'string' || !isSafeImageUrl(imageUrl, config.mediaAllowedHosts)))) {
    return response.status(400).json({ error: 'Post images must use HTTPS URLs from an approved image host.' });
  }
  if (allowedStatus === 'SCHEDULED' && (!schedule || !Number.isFinite(schedule.getTime()) || schedule <= new Date())) {
    return response.status(400).json({ error: 'Scheduled posts need a future publication time.' });
  }
  try {
    const groupTypeLabel = access.type === 'department' ? 'department' : 'Bible study group';
    const result = await pool.query(
      `INSERT INTO group_posts(group_id, group_type, title, body, image_url, image_urls, category, status,
          scheduled_at, published_by, published_at, idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,CASE WHEN $8::varchar='PUBLISHED' THEN NOW() ELSE COALESCE($9,NOW()) END,$11)
       ON CONFLICT (group_type,group_id,published_by,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING id, group_id AS "groupId", group_type AS "groupType", title, body,
          image_url AS "imageUrl", image_urls AS "imageUrls", category, status,
          published_at AS "publishedAt", published_by AS "publishedBy", created_at AS "createdAt"`,
      [access.id, access.type, cleanTitle, cleanBody, imageUrl || images[0] || null, JSON.stringify(images), allowedCategory, allowedStatus, schedule?.toISOString() ?? null, request.user.id, idempotencyKey]
    );
    if (!result.rowCount) {
      const existing = await pool.query(
        `SELECT id,group_id AS "groupId",group_type AS "groupType",title,body,image_url AS "imageUrl",
                image_urls AS "imageUrls",category,status,published_at AS "publishedAt",published_by AS "publishedBy",created_at AS "createdAt"
         FROM group_posts WHERE group_type=$1 AND group_id=$2 AND published_by=$3 AND idempotency_key=$4`,
        [access.type, access.id, request.user.id, idempotencyKey]
      );
      return response.status(200).json({ success: true, data: existing.rows[0] });
    }
    const post = result.rows[0];
    let telegramDelivery;
    if (allowedStatus === 'PUBLISHED') {
      telegramDelivery = await publishGroupPostToTelegram({
        post,
        group: { ...access.group, id: access.id },
        groupType: access.type,
      });
      notifyGroupFollowers(post, { ...access.group, id: access.id }, access.type)
        .catch((error) => console.error('[group notifications] queue failed:', error.message));
    }
    return response.status(201).json({ success: true, data: { ...post, telegramDelivery } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function uploadGroupPostImage(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  try {
    const result = await uploadImageToImgbb(request.file, config.imgbbApiKey, config.mediaAllowedHosts);
    return response.status(201).json({ success: true, data: { url: result.url } });
  } catch (error) {
    return response.status(error.status || 500).json({ error: error.message || 'Image upload failed.' });
  }
}

export async function updateGroupPost(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  const postId = validId(request.params.postId);
  if (!postId) return response.status(400).json({ error: 'Invalid post id.' });
  const { title, body, imageUrls, category, status, scheduledAt, isPinned } = request.body ?? {};
  const schedule = scheduledAt ? new Date(scheduledAt) : null;
  const validCategories = ['UPDATE', 'ANNOUNCEMENT', 'DEVOTIONAL', 'STORY', 'EVENT'];
  const validStatuses = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];
  if (scheduledAt && !Number.isFinite(schedule.getTime())) return response.status(400).json({ error: 'Invalid scheduled publication time.' });
  if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.trim().length > 200)) return response.status(400).json({ error: 'Post titles must contain 1 to 200 characters.' });
  if (body !== undefined && (typeof body !== 'string' || !body.trim() || body.trim().length > 12000)) return response.status(400).json({ error: 'Post content must contain 1 to 12000 characters.' });
  if (category !== undefined && !validCategories.includes(category)) return response.status(400).json({ error: 'Invalid post category.' });
  if (status !== undefined && !validStatuses.includes(status)) return response.status(400).json({ error: 'Invalid post status.' });
  if (status === 'SCHEDULED' && (!schedule || schedule <= new Date())) return response.status(400).json({ error: 'Scheduled posts need a future publication time.' });
  if (imageUrls !== undefined && (!Array.isArray(imageUrls) || imageUrls.length > 8 || imageUrls.some((url) => typeof url !== 'string' || url.length > 2048 || !isSafeImageUrl(url, config.mediaAllowedHosts)))) return response.status(400).json({ error: 'Post images must use approved image URLs (up to eight images).' });
  if (isPinned !== undefined && typeof isPinned !== 'boolean') return response.status(400).json({ error: 'Post pin state must be true or false.' });
  try {
    const previous = await pool.query('SELECT status FROM group_posts WHERE id=$1 AND group_id=$2 AND group_type=$3 AND deleted_at IS NULL', [postId, access.id, access.type]);
    if (!previous.rowCount) return response.status(404).json({ error: 'Post was not found.' });
    const result = await pool.query(
      `UPDATE group_posts SET
         title=COALESCE($4,title), body=COALESCE($5,body), image_urls=COALESCE($6::jsonb,image_urls),
         category=COALESCE($7,category), status=COALESCE($8,status), scheduled_at=COALESCE($9,scheduled_at),
         published_at=CASE WHEN $8='PUBLISHED' AND status<>'PUBLISHED' THEN NOW() ELSE published_at END,
         is_pinned=COALESCE($10,is_pinned), archived_at=CASE WHEN $8='ARCHIVED' THEN NOW() ELSE archived_at END,
         updated_at=NOW()
       WHERE id=$1 AND group_id=$2 AND group_type=$3 AND deleted_at IS NULL
       RETURNING id,group_id AS "groupId",group_type AS "groupType",title,body,image_url AS "imageUrl",image_urls AS "imageUrls",category,status,
         scheduled_at AS "scheduledAt",published_at AS "publishedAt",published_by AS "publishedBy",is_pinned AS "isPinned"`,
      [postId, access.id, access.type,
        typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null,
        typeof body === 'string' && body.trim() ? body.trim().slice(0, 12000) : null,
        Array.isArray(imageUrls) ? JSON.stringify(imageUrls.slice(0, 8)) : null,
        ['UPDATE', 'ANNOUNCEMENT', 'DEVOTIONAL', 'STORY', 'EVENT'].includes(category) ? category : null,
        ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].includes(status) ? status : null,
        schedule?.toISOString() ?? null,
        typeof isPinned === 'boolean' ? isPinned : null]
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Post was not found.' });
    let telegramDelivery;
    if (result.rows[0].status === 'PUBLISHED' && previous.rows[0].status !== 'PUBLISHED') {
      telegramDelivery = await publishGroupPostToTelegram({
        post: result.rows[0],
        group: { ...access.group, id: access.id },
        groupType: access.type,
      });
      notifyGroupFollowers(result.rows[0], access.group, access.type)
        .catch((error) => console.error('[group notifications] publish failed:', error.message));
    }
    return response.json({ success: true, data: { ...result.rows[0], telegramDelivery } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function deleteGroupPost(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  const postId = validId(request.params.postId);
  if (!postId) return response.status(400).json({ error: 'Invalid post id.' });
  try {
    const result = await pool.query('UPDATE group_posts SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1 AND group_id=$2 AND group_type=$3 AND deleted_at IS NULL RETURNING id', [postId, access.id, access.type]);
    if (!result.rowCount) return response.status(404).json({ error: 'Post was not found.' });
    return response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function togglePostLike(request, response) {
  const post = await requireVisiblePost(request, response);
  if (!post) return;
  const userId = request.user.id;
  try {
    if (request.method === 'DELETE') await pool.query('DELETE FROM group_post_likes WHERE post_id=$1 AND user_id=$2', [post.id, userId]);
    else await pool.query('INSERT INTO group_post_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT(post_id,user_id) DO NOTHING', [post.id, userId]);
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM group_post_likes WHERE post_id=$1', [post.id]);
    return response.json({ success: true, data: { liked: request.method !== 'DELETE', likeCount: result.rows[0].count } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listPostComments(request, response) {
  const post = await requireVisiblePost(request, response);
  if (!post) return;
  const limit = Math.min(50, Math.max(1, Number.parseInt(request.query.limit, 10) || 30));
  try {
    const result = await pool.query(
      `SELECT c.id,c.post_id AS "postId",c.parent_comment_id AS "parentCommentId",c.body,
              c.created_at AS "createdAt",c.edited_at AS "editedAt",u.id AS "userId",
              u.name AS "authorName",u.profile_image_url AS "authorImageUrl"
       FROM group_post_comments c JOIN users u ON u.id=c.user_id
       WHERE c.post_id=$1 AND c.deleted_at IS NULL AND c.hidden_at IS NULL
       ORDER BY c.created_at ASC,c.id ASC LIMIT $2`, [post.id, limit]
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function createPostComment(request, response) {
  const post = await requireVisiblePost(request, response);
  if (!post) return;
  const body = typeof request.body?.body === 'string' ? request.body.body.trim() : '';
  const parentId = request.body?.parentCommentId ? validId(request.body.parentCommentId) : null;
  if (!body || body.length > 3000) return response.status(400).json({ error: 'Comments must contain 1 to 3000 characters.' });
  try {
    if (parentId) {
      const parent = await pool.query('SELECT id FROM group_post_comments WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL AND hidden_at IS NULL', [parentId, post.id]);
      if (!parent.rowCount) return response.status(400).json({ error: 'The comment being replied to is unavailable.' });
    }
    const result = await pool.query(
      `INSERT INTO group_post_comments(post_id,user_id,parent_comment_id,body)
       VALUES($1,$2,$3,$4) RETURNING id,post_id AS "postId",parent_comment_id AS "parentCommentId",body,created_at AS "createdAt"`,
      [post.id, request.user.id, parentId, body]
    );
    const user = await pool.query('SELECT name,profile_image_url AS "authorImageUrl" FROM users WHERE id=$1', [request.user.id]);
    return response.status(201).json({ success: true, data: { ...result.rows[0], userId: request.user.id, authorName: user.rows[0]?.name, authorImageUrl: user.rows[0]?.authorImageUrl } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function updatePostComment(request, response) {
  const commentId = validId(request.params.commentId);
  const post = await requireVisiblePost(request, response);
  if (!post) return;
  const body = typeof request.body?.body === 'string' ? request.body.body.trim() : '';
  if (!commentId || !body || body.length > 3000) return response.status(400).json({ error: 'Comments must contain 1 to 3000 characters.' });
  try {
    const result = await pool.query(
      `UPDATE group_post_comments SET body=$4,edited_at=NOW(),updated_at=NOW()
       WHERE id=$1 AND post_id=$2 AND user_id=$3 AND deleted_at IS NULL AND hidden_at IS NULL
       RETURNING id,post_id AS "postId",parent_comment_id AS "parentCommentId",body,edited_at AS "editedAt",created_at AS "createdAt"`,
      [commentId, post.id, request.user.id, body]
    );
    if (!result.rowCount) return response.status(404).json({ error: 'Comment was not found or cannot be edited.' });
    return response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function deletePostComment(request, response) {
  const commentId = validId(request.params.commentId);
  const post = await requireVisiblePost(request, response);
  if (!post) return;
  if (!commentId) return response.status(400).json({ error: 'Invalid comment id.' });
  try {
    const own = await pool.query('UPDATE group_post_comments SET deleted_at=NOW(),updated_at=NOW() WHERE id=$1 AND post_id=$2 AND user_id=$3 AND deleted_at IS NULL RETURNING id', [commentId, post.id, request.user.id]);
    if (own.rowCount) return response.json({ success: true, data: { deleted: true } });
    const access = await managerAccess(request, response);
    if (!access) return;
    const result = await pool.query('UPDATE group_post_comments SET hidden_at=NOW(),moderated_by=$3,updated_at=NOW() WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL RETURNING id', [commentId, post.id, request.user.id]);
    if (!result.rowCount) return response.status(404).json({ error: 'Comment was not found.' });
    return response.json({ success: true, data: { deleted: true, moderated: true } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listManagedGroupPosts(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  try {
    const result = await pool.query(
      `SELECT p.id,p.title,p.body,p.category,p.status,p.scheduled_at AS "scheduledAt",
              p.published_at AS "publishedAt",p.created_at AS "createdAt",p.is_pinned AS "isPinned",
              u.name AS "authorName",gtd.status AS "telegramDeliveryStatus",
              gtd.error_message AS "telegramDeliveryError",gtd.delivered_at AS "telegramDeliveredAt"
       FROM group_posts p JOIN users u ON u.id=p.published_by
       LEFT JOIN group_telegram_deliveries gtd ON gtd.post_id=p.id
       WHERE p.group_id=$1 AND p.group_type=$2 AND p.deleted_at IS NULL
       ORDER BY CASE p.status WHEN 'DRAFT' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END,
                COALESCE(p.scheduled_at,p.published_at,p.created_at) DESC,p.id DESC LIMIT 100`,
      [access.id, access.type]
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function retryGroupPostTelegram(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  const postId = validId(request.params.postId);
  if (!postId) return response.status(400).json({ error: 'Invalid post id.' });
  try {
    const result = await pool.query(
      `SELECT p.id,p.group_id AS "groupId",p.group_type AS "groupType",p.title,p.body,
              p.image_url AS "imageUrl",p.image_urls AS "imageUrls"
       FROM group_posts p JOIN group_telegram_deliveries gtd ON gtd.post_id=p.id
       WHERE p.id=$1 AND p.group_id=$2 AND p.group_type=$3 AND p.status='PUBLISHED'
         AND p.deleted_at IS NULL AND gtd.status='FAILED'`,
      [postId, access.id, access.type],
    );
    if (!result.rowCount) {
      const delivery = await pool.query(
        `SELECT status FROM group_telegram_deliveries WHERE post_id=$1`,
        [postId],
      );
      if (!delivery.rowCount) return response.status(404).json({ error: 'Telegram delivery record was not found.' });
      if (delivery.rows[0].status === 'PENDING') return response.status(409).json({ error: 'Telegram delivery is already in progress.' });
      if (delivery.rows[0].status === 'SENT') return response.json({ success: true, data: { status: 'SENT', alreadyDelivered: true } });
      return response.status(409).json({ error: 'This post cannot be retried.' });
    }
    const delivery = await publishGroupPostToTelegram({
      post: result.rows[0],
      group: { ...access.group, id: access.id },
      groupType: access.type,
      retry: true,
    });
    if (delivery.status === 'FAILED') return response.status(502).json({ success: false, data: delivery, error: 'Telegram delivery failed. Check the destination and bot permissions, then retry.' });
    if (delivery.status === 'PENDING') return response.status(409).json({ error: delivery.message });
    return response.json({ success: true, data: delivery });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function groupManagementOverview(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  try {
    const membershipTable = access.type === 'department' ? 'department_members' : 'bible_study_memberships';
    const membershipGroupColumn = access.type === 'department' ? 'department_id' : 'bible_study_group_id';
    const result = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM group_follows WHERE group_id=$1 AND group_type=$2) AS followers,
              (SELECT COUNT(*)::int FROM ${membershipTable} WHERE ${membershipGroupColumn}=$1 AND status='ACTIVE') AS members,
              (SELECT COUNT(*)::int FROM group_posts WHERE group_id=$1 AND group_type=$2 AND deleted_at IS NULL AND status='PUBLISHED') AS posts,
              (SELECT COUNT(*)::int FROM group_posts WHERE group_id=$1 AND group_type=$2 AND deleted_at IS NULL AND status IN ('DRAFT','SCHEDULED')) AS drafts,
              (SELECT COUNT(*)::int FROM group_post_comments c JOIN group_posts p ON p.id=c.post_id
                WHERE p.group_id=$1 AND p.group_type=$2 AND c.deleted_at IS NULL AND c.hidden_at IS NULL) AS comments,
              (SELECT COALESCE(json_agg(recent), '[]'::json)
               FROM (SELECT id,title,category,status,published_at AS "publishedAt",created_at AS "createdAt"
                     FROM group_posts WHERE group_id=$1 AND group_type=$2 AND deleted_at IS NULL
                     ORDER BY COALESCE(published_at,created_at) DESC,id DESC LIMIT 5) recent) AS "recentPosts"`,
      [access.id, access.type]
    );
    return response.json({ success: true, data: { group: access.group, ...result.rows[0] } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function updateGroupSettings(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  const { name, description, locationText, meetingSchedule, currentStudy, telegramType, telegramUsername, telegramPublicLink, telegramInviteLink } = request.body ?? {};
  if ([name, description, locationText, meetingSchedule, currentStudy, telegramType, telegramUsername, telegramPublicLink, telegramInviteLink].some((value) => value !== undefined && typeof value !== 'string')) {
    return response.status(400).json({ error: 'Group settings must be text values.' });
  }
  const cleanName = typeof name === 'string' ? name.trim() : undefined;
  if (cleanName !== undefined && (!cleanName || cleanName.length > 150)) return response.status(400).json({ error: 'Group name must contain 1 to 150 characters.' });
  const telegramInputProvided = ['telegramType', 'telegramUsername', 'telegramPublicLink', 'telegramInviteLink']
    .some((key) => Object.hasOwn(request.body ?? {}, key));
  let cleanTelegramType = typeof telegramType === 'string'
    ? telegramType.trim().toLowerCase()
    : String(access.group.telegramType || 'none').toLowerCase();
  const configuredTelegramUsername = Object.hasOwn(request.body ?? {}, 'telegramUsername') ? telegramUsername : access.group.telegramUsername;
  const configuredTelegramPublicLink = Object.hasOwn(request.body ?? {}, 'telegramPublicLink') ? telegramPublicLink : access.group.telegramPublicLink;
  const configuredTelegramInviteLink = Object.hasOwn(request.body ?? {}, 'telegramInviteLink') ? telegramInviteLink : access.group.telegramInviteLink;
  if (telegramType === undefined && cleanTelegramType === 'none'
    && [configuredTelegramUsername, configuredTelegramPublicLink, configuredTelegramInviteLink].some((value) => typeof value === 'string' && value.trim())) {
    cleanTelegramType = 'group';
  }
  if (!['none', 'group', 'channel'].includes(cleanTelegramType)) {
    return response.status(400).json({ error: 'Telegram destination type must be group, channel, or none.' });
  }
  const cleanTelegramUsername = typeof configuredTelegramUsername === 'string' ? configuredTelegramUsername.trim().replace(/^@/, '') : '';
  if (cleanTelegramUsername.length > 64 || [configuredTelegramPublicLink, configuredTelegramInviteLink].some((value) => typeof value === 'string' && value.length > 2000)) {
    return response.status(400).json({ error: 'Telegram usernames and links are too long.' });
  }
  if (cleanTelegramUsername && !/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(cleanTelegramUsername)) {
    return response.status(400).json({ error: 'Telegram username must be a public group or channel username.' });
  }
  for (const value of [configuredTelegramPublicLink, configuredTelegramInviteLink].filter(Boolean)) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(url.hostname.toLowerCase()) || url.username || url.password) throw new Error('invalid');
    } catch {
      return response.status(400).json({ error: 'Telegram links must use an approved HTTPS Telegram address.' });
    }
  }
  if (configuredTelegramPublicLink && !telegramGroupDestination({ telegramPublicLink: configuredTelegramPublicLink })) {
    return response.status(400).json({ error: 'The public Telegram link must resolve to a username; use the invitation field for private join links.' });
  }
  if (cleanTelegramType !== 'none' && !cleanTelegramUsername && !configuredTelegramPublicLink && !configuredTelegramInviteLink) {
    return response.status(400).json({ error: 'Add a Telegram username or link, or select "Not connected".' });
  }
  try {
    const result = access.type === 'department'
      ? await pool.query(
        `UPDATE departments SET name=COALESCE($2,name),description=COALESCE($3,description),meeting_location=COALESCE($4,meeting_location),meeting_schedule=COALESCE($5,meeting_schedule),
           telegram_type=CASE WHEN $6::boolean THEN $10::department_telegram_type ELSE telegram_type END,
           telegram_username=CASE WHEN $6::boolean THEN CASE WHEN $10='none' THEN NULL ELSE NULLIF($7,'') END ELSE telegram_username END,
           telegram_public_link=CASE WHEN $6::boolean THEN CASE WHEN $10='none' THEN NULL ELSE NULLIF($8,'') END ELSE telegram_public_link END,
           telegram_invite_link=CASE WHEN $6::boolean THEN CASE WHEN $10='none' THEN NULL ELSE NULLIF($9,'') END ELSE telegram_invite_link END,
           telegram_connection_status=CASE WHEN $6::boolean AND (telegram_type IS DISTINCT FROM $10::department_telegram_type
             OR telegram_username IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($7,'') END
             OR telegram_public_link IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($8,'') END
             OR telegram_invite_link IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($9,'') END)
             THEN (CASE WHEN $10='none' THEN 'UNVERIFIED' ELSE 'PENDING' END)::department_connection_status ELSE telegram_connection_status END,
           telegram_verified_at=CASE WHEN $6::boolean AND (telegram_type IS DISTINCT FROM $10::department_telegram_type
             OR telegram_username IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($7,'') END
             OR telegram_public_link IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($8,'') END
             OR telegram_invite_link IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($9,'') END) THEN NULL ELSE telegram_verified_at END,
           telegram_verify_error=CASE WHEN $6::boolean AND (telegram_type IS DISTINCT FROM $10::department_telegram_type
             OR telegram_username IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($7,'') END
             OR telegram_public_link IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($8,'') END
             OR telegram_invite_link IS DISTINCT FROM CASE WHEN $10='none' THEN NULL ELSE NULLIF($9,'') END) THEN NULL ELSE telegram_verify_error END,updated_at=NOW()
         WHERE id=$1 AND deleted_at IS NULL
         RETURNING id,name,description,meeting_location AS "locationText",meeting_schedule AS "meetingSchedule",
           telegram_username AS "telegramUsername",telegram_public_link AS "telegramPublicLink",
           telegram_invite_link AS "telegramInviteLink",telegram_type AS "telegramType",
           telegram_connection_status AS "telegramConnectionStatus"`,
        [access.id, cleanName ?? null, typeof description === 'string' ? description.slice(0, 12000) : null, typeof locationText === 'string' ? locationText.slice(0, 500) : null, typeof meetingSchedule === 'string' ? meetingSchedule.slice(0, 500) : null, telegramInputProvided, cleanTelegramUsername, typeof configuredTelegramPublicLink === 'string' ? configuredTelegramPublicLink.trim() : '', typeof configuredTelegramInviteLink === 'string' ? configuredTelegramInviteLink.trim() : '', cleanTelegramType]
      )
      : await pool.query(
        `UPDATE bible_study_groups SET name=COALESCE($2,name),description=COALESCE($3,description),location_text=COALESCE($4,location_text),meeting_schedule=COALESCE($5,meeting_schedule),current_study=COALESCE($6,current_study),
           telegram_type=CASE WHEN $7::boolean THEN $11::group_telegram_type ELSE telegram_type END,
           telegram_username=CASE WHEN $7::boolean THEN CASE WHEN $11='none' THEN NULL ELSE NULLIF($8,'') END ELSE telegram_username END,
           telegram_public_link=CASE WHEN $7::boolean THEN CASE WHEN $11='none' THEN NULL ELSE NULLIF($9,'') END ELSE telegram_public_link END,
           telegram_invite_link=CASE WHEN $7::boolean THEN CASE WHEN $11='none' THEN NULL ELSE NULLIF($10,'') END ELSE telegram_invite_link END,
           telegram_connection_status=CASE WHEN $7::boolean AND (telegram_type IS DISTINCT FROM $11::group_telegram_type
             OR telegram_username IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($8,'') END
             OR telegram_public_link IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($9,'') END
             OR telegram_invite_link IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($10,'') END)
             THEN (CASE WHEN $11='none' THEN 'UNVERIFIED' ELSE 'PENDING' END)::group_connection_status ELSE telegram_connection_status END,
           telegram_verified_at=CASE WHEN $7::boolean AND (telegram_type IS DISTINCT FROM $11::group_telegram_type
             OR telegram_username IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($8,'') END
             OR telegram_public_link IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($9,'') END
             OR telegram_invite_link IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($10,'') END) THEN NULL ELSE telegram_verified_at END,
           telegram_verify_error=CASE WHEN $7::boolean AND (telegram_type IS DISTINCT FROM $11::group_telegram_type
             OR telegram_username IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($8,'') END
             OR telegram_public_link IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($9,'') END
             OR telegram_invite_link IS DISTINCT FROM CASE WHEN $11='none' THEN NULL ELSE NULLIF($10,'') END) THEN NULL ELSE telegram_verify_error END,updated_at=NOW()
         WHERE id=$1 AND deleted_at IS NULL
         RETURNING id,name,description,location_text AS "locationText",meeting_schedule AS "meetingSchedule",
           current_study AS "currentStudy",telegram_username AS "telegramUsername",telegram_public_link AS "telegramPublicLink",
           telegram_invite_link AS "telegramInviteLink",telegram_type AS "telegramType",
           telegram_connection_status AS "telegramConnectionStatus"`,
        [access.id, cleanName ?? null, typeof description === 'string' ? description.slice(0, 12000) : null, typeof locationText === 'string' ? locationText.slice(0, 500) : null, typeof meetingSchedule === 'string' ? meetingSchedule.slice(0, 500) : null, typeof currentStudy === 'string' ? currentStudy.slice(0, 500) : null, telegramInputProvided, cleanTelegramUsername, typeof configuredTelegramPublicLink === 'string' ? configuredTelegramPublicLink.trim() : '', typeof configuredTelegramInviteLink === 'string' ? configuredTelegramInviteLink.trim() : '', cleanTelegramType]
      );
    if (!result.rowCount) return response.status(404).json({ error: 'Group was not found.' });
    return response.json({ success: true, data: result.rows[0] });
  } catch (error) { return requestError(error, response); }
}

export async function listGroupFollowers(request, response) {
  const access = await managerAccess(request, response);
  if (!access) return;
  const search = String(request.query.search ?? '').trim().slice(0, 100);
  try {
    const result = await pool.query(
      `SELECT u.id,u.name,u.profile_image_url AS "profileImageUrl",gf.created_at AS "followedAt"
       FROM group_follows gf JOIN users u ON u.id=gf.user_id
       WHERE gf.group_id=$1 AND gf.group_type=$2 AND ($3='' OR u.name ILIKE '%'||$3||'%')
       ORDER BY gf.created_at DESC LIMIT 100`, [access.id, access.type, search]
    );
    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return requestError(error, response);
  }
}
