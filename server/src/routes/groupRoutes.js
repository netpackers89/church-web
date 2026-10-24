import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireUser } from '../middleware/requireUser.js';
import {
  listGroups,
  getGroup,
  followGroup,
  unfollowGroup,
  listFollowedGroups,
  updateNotificationPreferences,
  groupFollowStatus,
  getNotificationPreferences,
} from '../controllers/groupController.js';
import {
  createGroupPost,
  createPostComment,
  createGroupProgram,
  deleteGroupPost,
  deletePostComment,
  groupManagementOverview,
  listGroupFollowers,
  listManagedGroupPosts,
  listGroupPosts,
  listGroupPrograms,
  listPostComments,
  retryGroupPostTelegram,
  togglePostLike,
  updateGroupPost,
  updateGroupSettings,
  updatePostComment,
  uploadGroupPostImage,
  testManagedGroupCommunication,
} from '../controllers/groupSocialController.js';

const router = Router();
const groupImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)),
});
const groupTelegramTestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many Telegram tests for this group. Try again in a few minutes.' },
});

router.get('/', listGroups);

router.get('/:id/follow-status', requireUser, groupFollowStatus);
router.get('/:id/management', requireUser, groupManagementOverview);
router.post('/:id/communications/test', requireUser, groupTelegramTestLimiter, testManagedGroupCommunication);
router.get('/:id/management/posts', requireUser, listManagedGroupPosts);
router.patch('/:id/settings', requireUser, updateGroupSettings);
router.get('/:id/followers', requireUser, listGroupFollowers);
router.get('/:id/programs', listGroupPrograms);
router.post('/:id/programs', requireUser, createGroupProgram);

router.post('/:id/follow', requireUser, followGroup);
router.delete('/:id/follow', requireUser, unfollowGroup);
router.get('/followed', requireUser, listFollowedGroups);

router.get('/:id/posts', listGroupPosts);
router.post('/:id/posts', requireUser, createGroupPost);
router.post('/:id/media/upload', requireUser, (request, response, next) => {
  groupImageUpload.single('image')(request, response, (error) => {
    if (error) return response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message || 'The image could not be processed.' });
    next();
  });
}, uploadGroupPostImage);
router.patch('/:id/posts/:postId', requireUser, updateGroupPost);
router.post('/:id/posts/:postId/telegram/retry', requireUser, retryGroupPostTelegram);
router.delete('/:id/posts/:postId', requireUser, deleteGroupPost);
router.post('/:id/posts/:postId/like', requireUser, togglePostLike);
router.delete('/:id/posts/:postId/like', requireUser, togglePostLike);
router.get('/:id/posts/:postId/comments', listPostComments);
router.post('/:id/posts/:postId/comments', requireUser, createPostComment);
router.patch('/:id/posts/:postId/comments/:commentId', requireUser, updatePostComment);
router.delete('/:id/posts/:postId/comments/:commentId', requireUser, deletePostComment);
router.patch('/:id/notification-preferences', requireUser, updateNotificationPreferences);
router.get('/:id/notification-preferences', requireUser, getNotificationPreferences);

router.get('/:id', getGroup);

router.get('/joined', requireUser, async (request, response) => {
  try {
    const userId = request.user.id;
    const [departments, bibleStudies] = await Promise.all([
      (await import('../config/db.js')).pool.query(
        `SELECT d.id, d.name, d.description, d.logo_url AS "logoUrl", d.banner_url AS "bannerUrl",
                d.location_text AS "locationText", d.meeting_schedule AS "meetingSchedule",
                d.category, d.leader_name AS "leaderName",
                (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id AND dm.status = 'ACTIVE') AS "memberCount"
         FROM department_members dm
         JOIN departments d ON d.id = dm.department_id
         WHERE dm.user_id = $1 AND dm.status = 'ACTIVE'
           AND d.is_active = TRUE AND d.deleted_at IS NULL
         ORDER BY d.name`,
        [userId]
      ),
      (await import('../config/db.js')).pool.query(
        `SELECT g.id, g.name, g.description, g.group_profile_image AS "logoUrl", g.banner_image AS "bannerUrl",
                g.location_text AS "locationText", g.meeting_schedule AS "meetingSchedule",
                g.current_study AS "currentStudy", g.leader_name AS "leaderName",
                (SELECT COUNT(*) FROM bible_study_memberships bm WHERE bm.bible_study_group_id = g.id) AS "memberCount"
         FROM bible_study_memberships bm
         JOIN bible_study_groups g ON g.id = bm.bible_study_group_id
         WHERE bm.user_id = $1
           AND g.is_active = TRUE AND g.deleted_at IS NULL
         ORDER BY g.name`,
        [userId]
      ),
    ]);

    const groups = [
      ...departments.rows.map((d) => ({ ...d, type: 'department', memberCount: Number(d.memberCount || 0) })),
      ...bibleStudies.rows.map((g) => ({ ...g, type: 'bible_study_group', memberCount: Number(g.memberCount || 0) })),
    ];

    return response.json({ success: true, data: groups });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

export default router;
