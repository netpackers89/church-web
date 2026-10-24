import { pool } from '../config/db.js';
import { queueGroupPostNotifications } from '../services/groupNotificationService.js';
import { sendGroupFollowWelcome } from '../services/groupFollowWelcome.js';
import { requestError } from '../utils/http.js';

function groupTypeFromRequest(request) {
  const groupType = request.query.type;
  return groupType === 'department' || groupType === 'bible_study_group' ? groupType : null;
}

function publicCommunityLinks(group) {
  const configured = Array.isArray(group.communityLinks) ? group.communityLinks : [];
  const supportedPlatforms = new Set(['telegram', 'facebook', 'youtube']);
  const links = configured
    .filter((link) => link && supportedPlatforms.has(String(link.platform ?? '').toLowerCase())
      && link.enabled === true && typeof link.url === 'string')
    .map((link) => ({
      platform: String(link.platform || 'other').slice(0, 30),
      label: String(link.label || link.platform || 'Community link').slice(0, 80),
      url: link.url,
    }));
  const configuredPlatforms = new Set(configured.map((link) => link?.platform));
  const legacy = [
    ['telegram', group.telegramInviteLink, 'Telegram invitation link'],
    ['telegram', group.telegramPublicLink, 'Telegram public link'],
    ['facebook', group.facebookUrl, 'Facebook'],
    ['youtube', group.youtubeUrl, 'YouTube'],
  ];
  for (const [platform, url, label] of legacy) {
    if (url && !configuredPlatforms.has(platform)) links.push({ platform, label, url });
  }
  return links.filter(({ url }) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  });
}

async function resolveGroup(groupType, groupId) {
  if (groupType === 'department') {
    const result = await pool.query(
      `SELECT d.id, d.name, d.description, d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
              d.meeting_location AS "locationText", d.meeting_schedule AS "meetingSchedule",
              NULL::integer AS capacity, d.category, d.min_age AS "minAge",
              d.max_age AS "maxAge", d.telegram_public_link AS "telegramPublicLink",
              d.telegram_invite_link AS "telegramInviteLink", d.facebook_url AS "facebookUrl",
              d.youtube_url AS "youtubeUrl", d.community_links AS "communityLinks",
              (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id=d.id AND dm.status = 'ACTIVE')::int AS "memberCount",
              (SELECT COUNT(*)::int FROM group_follows gf WHERE gf.group_id=d.id AND gf.group_type='department') AS "followerCount",
              (SELECT p.id FROM group_posts p WHERE p.group_id=d.id AND p.group_type='department' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostId",
              (SELECT p.title FROM group_posts p WHERE p.group_id=d.id AND p.group_type='department' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostTitle",
              d.leader_name AS "leaderName", d.leader_user_id AS "leaderUserId",
              (d.visibility = 'PUBLIC') AS "isPublic", d.is_active AS "isActive", d.deleted_at,
              d.created_at, d.updated_at
       FROM departments d WHERE d.id = $1 AND d.deleted_at IS NULL`, [groupId]
    );

    const group = result.rows[0] ?? null;
    return group ? { ...group, communityLinks: publicCommunityLinks(group) } : null;
  }
  if (groupType === 'bible_study_group') {
    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.group_profile_image AS "logoUrl", g.banner_image AS "bannerUrl",
              g.location_text AS "locationText", g.google_maps_link AS "googleMapsLink",
              g.meeting_schedule AS "meetingSchedule", g.capacity, g.current_study AS "currentStudy",
              g.telegram_public_link AS "telegramPublicLink", g.telegram_invite_link AS "telegramInviteLink",
              g.facebook_url AS "facebookUrl", g.youtube_url AS "youtubeUrl", g.community_links AS "communityLinks",
              (SELECT COUNT(*) FROM bible_study_memberships bm WHERE bm.bible_study_group_id=g.id)::int AS "memberCount",
              (SELECT COUNT(*)::int FROM group_follows gf WHERE gf.group_id=g.id AND gf.group_type='bible_study_group') AS "followerCount",
              (SELECT p.id FROM group_posts p WHERE p.group_id=g.id AND p.group_type='bible_study_group' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostId",
              (SELECT p.title FROM group_posts p WHERE p.group_id=g.id AND p.group_type='bible_study_group' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostTitle",
              g.group_email AS "groupEmail", g.leader_name AS "leaderName", g.leader_user_id AS "leaderUserId",
              (g.is_public AND g.visibility = 'public') AS "isPublic", g.is_active AS "isActive", g.deleted_at,
              g.created_at, g.updated_at
       FROM bible_study_groups g WHERE g.id = $1 AND g.deleted_at IS NULL`, [groupId]
    );
    const group = result.rows[0] ?? null;
    return group ? { ...group, communityLinks: publicCommunityLinks(group) } : null;
  }
  return null;
}

export async function listGroups(request, response) {
  try {
    const [departments, bibleStudies] = await Promise.all([
      pool.query(
        `SELECT d.id, d.name, d.description, d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
                d.meeting_location AS "locationText", d.meeting_schedule AS "meetingSchedule",
                d.category, d.min_age AS "minAge", d.max_age AS "maxAge", d.leader_name AS "leaderName",
                d.community_links AS "communityLinks", d.telegram_public_link AS "telegramPublicLink",
                d.telegram_invite_link AS "telegramInviteLink", d.facebook_url AS "facebookUrl",
                d.youtube_url AS "youtubeUrl",
                (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'ACTIVE') AS "memberCount",
                (SELECT COUNT(*)::int FROM group_follows gf WHERE gf.group_id=d.id AND gf.group_type='department') AS "followerCount",
                (SELECT p.id FROM group_posts p WHERE p.group_id=d.id AND p.group_type='department' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostId",
                (SELECT p.title FROM group_posts p WHERE p.group_id=d.id AND p.group_type='department' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostTitle",
                d.created_at, d.updated_at
         FROM departments d
         WHERE d.visibility = 'PUBLIC' AND d.is_active = TRUE AND d.deleted_at IS NULL
         ORDER BY d.name`,
        []
      ),
      pool.query(
        `SELECT g.id, g.name, g.description, g.group_profile_image AS "logoUrl", g.banner_image AS "bannerUrl",
                g.location_text AS "locationText", g.meeting_schedule AS "meetingSchedule",
                g.current_study AS "currentStudy", g.leader_name AS "leaderName",
                g.community_links AS "communityLinks", g.telegram_public_link AS "telegramPublicLink",
                g.telegram_invite_link AS "telegramInviteLink", g.facebook_url AS "facebookUrl",
                g.youtube_url AS "youtubeUrl",
                (SELECT COUNT(*) FROM bible_study_memberships bm WHERE bm.bible_study_group_id = g.id) AS "memberCount",
                (SELECT COUNT(*)::int FROM group_follows gf WHERE gf.group_id=g.id AND gf.group_type='bible_study_group') AS "followerCount",
                (SELECT p.id FROM group_posts p WHERE p.group_id=g.id AND p.group_type='bible_study_group' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostId",
                (SELECT p.title FROM group_posts p WHERE p.group_id=g.id AND p.group_type='bible_study_group' AND p.status='PUBLISHED' AND p.deleted_at IS NULL ORDER BY p.is_pinned DESC,p.published_at DESC LIMIT 1) AS "recentPostTitle",
                g.created_at, g.updated_at
         FROM bible_study_groups g
         WHERE g.is_public = TRUE AND g.visibility = 'public' AND g.is_active = TRUE AND g.deleted_at IS NULL
         ORDER BY g.name`,
        []
      ),
    ]);

    const groups = [
      ...departments.rows.map((d) => ({ ...d, type: 'department', memberCount: Number(d.memberCount || 0), communityLinks: publicCommunityLinks(d) })),
      ...bibleStudies.rows.map((g) => ({ ...g, type: 'bible_study_group', memberCount: Number(g.memberCount || 0), communityLinks: publicCommunityLinks(g) })),
    ];

    return response.json({ success: true, data: groups });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function getGroup(request, response) {
  try {
    const groupType = groupTypeFromRequest(request);
    const groupId = Number(request.params.id);
    if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) {
      return response.status(400).json({ error: 'Invalid group request.' });
    }

    const group = await resolveGroup(groupType, groupId);
    if (!group || !group.isPublic || !group.isActive) {
      return response.status(404).json({ error: 'Group was not found.' });
    }

    let followStatus = null;
    let memberRole = null;
    if (request.user) {
      const followResult = await pool.query(
        `SELECT id FROM group_follows WHERE user_id = $1 AND group_id = $2 AND group_type = $3`,
        [request.user.id, groupId, groupType]
      );
      followStatus = followResult.rowCount > 0;

      if (groupType === 'department') {
        const memberResult = await pool.query(
          `SELECT role FROM department_members WHERE department_id = $1 AND user_id = $2 AND status = 'ACTIVE'`,
          [groupId, request.user.id]
        );
        if (memberResult.rowCount > 0) memberRole = memberResult.rows[0].role;
      } else {
        const memberResult = await pool.query(
          `SELECT role FROM bible_study_memberships WHERE bible_study_group_id = $1 AND user_id = $2`,
          [groupId, request.user.id]
        );
        if (memberResult.rowCount > 0) memberRole = memberResult.rows[0].role;
      }
    }

    return response.json({
      success: true,
      data: { ...group, type: groupType, isFollowing: followStatus, memberRole },
    });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function followGroup(request, response) {
  try {
    const groupType = groupTypeFromRequest(request);
    const groupId = Number(request.params.id);
    const userId = request.user.id;

    if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) {
      return response.status(400).json({ error: 'Invalid group request.' });
    }

    const group = await resolveGroup(groupType, groupId);
    if (!group || !group.isPublic || !group.isActive) {
      return response.status(404).json({ error: 'Group was not found.' });
    }

    const result = await pool.query(
      `WITH followed AS (
         INSERT INTO group_follows (user_id, group_id, group_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, group_id, group_type) DO NOTHING
         RETURNING id
       ), preferences AS (
         INSERT INTO group_notification_preferences (user_id, group_id, group_type, email_enabled, telegram_enabled, in_app_enabled)
         VALUES ($1, $2, $3, TRUE, TRUE, TRUE)
         ON CONFLICT DO NOTHING
         RETURNING id
       )
       SELECT id FROM followed`,
      [userId, groupId, groupType],
    );

    if (result.rowCount) {
      sendGroupFollowWelcome({ userId, group: { ...group, id: groupId }, groupType })
        .catch((error) => console.error('[group follow] welcome notification failed:', error.message));
    }
    const telegramResult = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM telegram_accounts WHERE user_id=$1) AS connected',
      [userId],
    );

    return response.status(result.rowCount ? 201 : 200).json({
      success: true,
      data: {
        status: result.rowCount ? 'following' : 'already_following',
        group: { ...group, type: groupType },
        telegramConnected: Boolean(telegramResult.rows[0]?.connected),
      },
      message: result.rowCount ? `You are now following ${group.name}.` : `You are already following ${group.name}.`,
    });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function groupFollowStatus(request, response) {
  const groupType = groupTypeFromRequest(request);
  const groupId = Number(request.params.id);
  if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) {
    return response.status(400).json({ error: 'Invalid group request.' });
  }
  try {
    const group = await resolveGroup(groupType, groupId);
    if (!group || !group.isPublic || !group.isActive) {
      return response.status(404).json({ error: 'Group was not found.' });
    }
    const result = await pool.query(
      `SELECT id FROM group_follows WHERE user_id = $1 AND group_id = $2 AND group_type = $3`,
      [request.user.id, groupId, groupType],
    );
    return response.json({ success: true, data: { isFollowing: result.rowCount > 0 } });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function unfollowGroup(request, response) {
  try {
    const groupType = groupTypeFromRequest(request);
    const groupId = Number(request.params.id);
    const userId = request.user.id;

    if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) {
      return response.status(400).json({ error: 'Invalid group request.' });
    }

    await pool.query(
      `DELETE FROM group_follows WHERE user_id = $1 AND group_id = $2 AND group_type = $3`,
      [userId, groupId, groupType]
    );

    return response.json({ success: true, data: { status: 'unfollowed' }, message: 'You have unfollowed this group.' });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listFollowedGroups(request, response) {
  try {
    const userId = request.user.id;

    const [departments, bibleStudies] = await Promise.all([
      pool.query(
        `SELECT d.id, d.name, d.description, d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
                d.meeting_location AS "locationText", d.meeting_schedule AS "meetingSchedule",
                d.category, d.leader_name AS "leaderName",
                (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'ACTIVE') AS "memberCount",
                gf.created_at AS "followedAt"
         FROM group_follows gf
         JOIN departments d ON d.id = gf.group_id
         WHERE gf.user_id = $1 AND gf.group_type = 'department'
           AND d.is_active = TRUE AND d.deleted_at IS NULL
         ORDER BY gf.created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT g.id, g.name, g.description, g.group_profile_image AS "logoUrl", g.banner_image AS "bannerUrl",
                g.location_text AS "locationText", g.meeting_schedule AS "meetingSchedule",
                g.current_study AS "currentStudy", g.leader_name AS "leaderName",
                (SELECT COUNT(*) FROM bible_study_memberships bm WHERE bm.bible_study_group_id = g.id) AS "memberCount",
                gf.created_at AS "followedAt"
         FROM group_follows gf
         JOIN bible_study_groups g ON g.id = gf.group_id
         WHERE gf.user_id = $1 AND gf.group_type = 'bible_study_group'
           AND g.is_active = TRUE AND g.deleted_at IS NULL
         ORDER BY gf.created_at DESC`,
        [userId]
      ),
    ]);

    const groups = [
      ...departments.rows.map((d) => ({ ...d, type: 'department', memberCount: Number(d.memberCount || 0) })),
      ...bibleStudies.rows.map((g) => ({ ...g, type: 'bible_study_group', memberCount: Number(g.memberCount || 0) })),
    ];

    return response.json({ success: true, data: groups });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function listGroupPosts(request, response) {
  try {
    const groupType = groupTypeFromRequest(request);
    const groupId = Number(request.params.id);
    if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) {
      return response.status(400).json({ error: 'Invalid group request.' });
    }

    const result = await pool.query(
      `SELECT p.id, p.title, p.body, p.image_url AS "imageUrl", p.published_by AS "publishedBy",
              p.published_at AS "publishedAt", p.created_at, p.updated_at,
              u.name AS "authorName"
       FROM group_posts p
       JOIN users u ON u.id = p.published_by
       WHERE p.group_id = $1 AND p.group_type = $2 AND p.deleted_at IS NULL
       ORDER BY p.published_at DESC`,
      [groupId, groupType]
    );

    return response.json({ success: true, data: result.rows });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function createGroupPost(request, response) {
  try {
    const groupType = groupTypeFromRequest(request);
    const groupId = Number(request.params.id);
    const userId = request.user.id;
    const { title, body, imageUrl } = request.body ?? {};

    if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) {
      return response.status(400).json({ error: 'Invalid group request.' });
    }
    if (!title || !body) {
      return response.status(400).json({ error: 'Title and body are required.' });
    }

    const group = await resolveGroup(groupType, groupId);
    if (!group) {
      return response.status(404).json({ error: 'Group was not found.' });
    }

    const isLeader = group.leader_user_id && String(group.leader_user_id) === String(userId);
    const isMember = await pool.query(
      groupType === 'department'
        ? `SELECT 1 FROM department_members WHERE department_id = $1 AND user_id = $2 AND status = 'ACTIVE'`
        : `SELECT 1 FROM bible_study_memberships WHERE bible_study_group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    const hasGlobalAuthority = ['SYSTEM_OWNER', 'ADMIN', 'PASTOR'].some((r) => (request.user.roles ?? []).includes(r));
    const canPost = isLeader || isMember.rowCount > 0 || hasGlobalAuthority;

    if (!canPost) {
      return response.status(403).json({ error: 'You do not have permission to post in this group.' });
    }

    const result = await pool.query(
      `INSERT INTO group_posts (group_id, group_type, title, body, image_url, published_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, body, image_url AS "imageUrl", published_by AS "publishedBy", published_at AS "publishedAt"`,
      [groupId, groupType, title.trim(), body.trim(), imageUrl || null, userId]
    );

    const post = result.rows[0];

    const followers = await pool.query(
      `SELECT gf.user_id, u.email, u.telegram_chat_id,
              gnp.email_enabled, gnp.telegram_enabled, gnp.in_app_enabled
       FROM group_follows gf
       JOIN users u ON u.id = gf.user_id
       LEFT JOIN group_notification_preferences gnp
         ON gnp.user_id = gf.user_id AND gnp.group_id = gf.group_id AND gnp.group_type = gf.group_type
       WHERE gf.group_id = $1 AND gf.group_type = $2`,
      [groupId, groupType]
    );

    await queueGroupPostNotifications({
      post,
      group,
      followersWithPrefs: followers.rows,
      churchName: 'Addis Lidet International Church',
      churchContact: 'office@alic.org · +251 11 123 4567',
      churchSocialLinks: [
        { label: 'Website', url: 'https://alic.org' },
        { label: 'Telegram', url: 'https://t.me/AbadoMuluWengelBot' },
      ],
    }).catch((error) => {
      console.error('[group notifications] queue failed:', error.message);
    });

    return response.status(201).json({ success: true, data: post });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function updateNotificationPreferences(request, response) {
  try {
    const groupType = groupTypeFromRequest(request);
    const groupId = Number(request.params.id);
    const userId = request.user.id;
    const { emailEnabled, telegramEnabled, inAppEnabled } = request.body ?? {};

    if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) {
      return response.status(400).json({ error: 'Invalid group request.' });
    }
    if ([emailEnabled, telegramEnabled, inAppEnabled].some((value) => value !== undefined && typeof value !== 'boolean')) {
      return response.status(400).json({ error: 'Notification preferences must be true or false.' });
    }
    const followed = await pool.query('SELECT 1 FROM group_follows WHERE user_id=$1 AND group_id=$2 AND group_type=$3', [userId, groupId, groupType]);
    if (!followed.rowCount) return response.status(403).json({ error: 'Follow this group before changing its notifications.' });

    const result = await pool.query(
      `INSERT INTO group_notification_preferences (user_id, group_id, group_type, email_enabled, telegram_enabled, in_app_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, group_id, group_type)
       DO UPDATE SET email_enabled = EXCLUDED.email_enabled,
                     telegram_enabled = EXCLUDED.telegram_enabled,
                     in_app_enabled = EXCLUDED.in_app_enabled,
                     updated_at = NOW()
       RETURNING email_enabled AS "emailEnabled", telegram_enabled AS "telegramEnabled", in_app_enabled AS "inAppEnabled"`,
      [userId, groupId, groupType,
        emailEnabled !== undefined ? emailEnabled : true,
        telegramEnabled !== undefined ? telegramEnabled : true,
        inAppEnabled !== undefined ? inAppEnabled : true]
    );

    return response.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return requestError(error, response);
  }
}

export async function getNotificationPreferences(request, response) {
  const groupType = groupTypeFromRequest(request);
  const groupId = Number(request.params.id);
  if (!groupType || !Number.isSafeInteger(groupId) || groupId < 1) return response.status(400).json({ error: 'Invalid group request.' });
  try {
    const followed = await pool.query('SELECT 1 FROM group_follows WHERE user_id=$1 AND group_id=$2 AND group_type=$3', [request.user.id, groupId, groupType]);
    if (!followed.rowCount) return response.status(403).json({ error: 'Follow this group before changing its notifications.' });
    const result = await pool.query(
      `SELECT email_enabled AS "emailEnabled",telegram_enabled AS "telegramEnabled",in_app_enabled AS "inAppEnabled"
       FROM group_notification_preferences WHERE user_id=$1 AND group_id=$2 AND group_type=$3`,
      [request.user.id, groupId, groupType]
    );
    return response.json({ success: true, data: result.rows[0] ?? { emailEnabled: true, telegramEnabled: true, inAppEnabled: true } });
  } catch (error) { return requestError(error, response); }
}
