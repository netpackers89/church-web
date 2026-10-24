import cron from 'node-cron';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { queueGroupPostNotifications } from './groupNotificationService.js';
import { publishGroupPostToTelegram } from './groupTelegramPublishing.js';

let task;

export async function publishDueGroupPosts() {
  const due = await pool.query(
    `UPDATE group_posts SET status='PUBLISHED',published_at=NOW(),updated_at=NOW()
     WHERE status='SCHEDULED' AND scheduled_at <= NOW() AND deleted_at IS NULL
     RETURNING id,group_id AS "groupId",group_type AS "groupType",title,body,image_url AS "imageUrl",image_urls AS "imageUrls",category,published_at AS "publishedAt",published_by AS "publishedBy"`
  );
  for (const post of due.rows) {
    try {
      const groupTable = post.groupType === 'department' ? 'departments' : 'bible_study_groups';
      const groupImage = post.groupType === 'department' ? 'banner_url' : 'banner_image';
      const group = await pool.query(
        `SELECT id,name,${groupImage} AS banner_url,telegram_type AS "telegramType",telegram_username AS "telegramUsername",
                telegram_public_link AS "telegramPublicLink",telegram_invite_link AS "telegramInviteLink",
                community_links AS "communityLinks"
         FROM ${groupTable} WHERE id=$1`,
        [post.groupId],
      );
      if (!group.rowCount) continue;
      const telegramDelivery = await publishGroupPostToTelegram({
        post,
        group: { ...group.rows[0], id: post.groupId },
        groupType: post.groupType,
      });
      if (telegramDelivery.status === 'FAILED') {
        console.error(`[group post scheduler] Telegram delivery failed for post ${post.id}:`, telegramDelivery.error);
      }
      const followers = await pool.query(
        `SELECT gf.user_id,u.email,u.telegram_chat_id,u.notify_email,u.notify_telegram,
                gnp.email_enabled,gnp.telegram_enabled,gnp.in_app_enabled
         FROM group_follows gf JOIN users u ON u.id=gf.user_id
         LEFT JOIN group_notification_preferences gnp ON gnp.user_id=gf.user_id AND gnp.group_id=gf.group_id AND gnp.group_type=gf.group_type
         WHERE gf.group_id=$1 AND gf.group_type=$2`, [post.groupId, post.groupType]
      );
      await queueGroupPostNotifications({
        post,
        group: { ...group.rows[0], group_type: post.groupType },
        followersWithPrefs: followers.rows,
        churchName: config.branding.churchName,
        churchContact: [config.branding.email, config.branding.phone].filter(Boolean).join(' · '),
        churchSocialLinks: [config.branding.websiteUrl && { label: 'Website', url: config.branding.websiteUrl }, config.branding.telegramUrl && { label: 'Telegram', url: config.branding.telegramUrl }].filter(Boolean),
      });
    } catch (error) {
      console.error(`[group post scheduler] notification failed for post ${post.id}:`, error.message);
    }
  }
  return due.rows.length;
}

export function startGroupPostScheduler() {
  if (task) return task;
  task = cron.schedule('* * * * *', () => {
    void publishDueGroupPosts().catch((error) => console.error('[group post scheduler] failed:', error.message));
  });
  void publishDueGroupPosts().catch((error) => console.error('[group post scheduler] startup check failed:', error.message));
  return task;
}

export function stopGroupPostScheduler() {
  task?.stop();
  task = undefined;
}
