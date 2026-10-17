import { Router } from 'express';
import multer from 'multer';
import {
  auditLogs,
  createAnnouncement,
  listAnnouncements,
  listVersePublications,
  publishVerse,
  report,
  replyToTelegramMessage,
  roles,
  setUserRoles,
  settings,
  telegramInbox,
  updateSettings,
  updateTelegramMessage,
  updateUserStatus,
  updateAnnouncement,
  updateVersePublication,
  archiveVersePublication,
  listPermissions,
  createRole,
  updateRole,
  setRolePermissions,
  deleteRole,
  listWebsiteNotifications,
  createWebsiteNotification,
  archiveWebsiteNotification,
  testCommunication,
} from '../controllers/adminController.js';
import { approveDonation, listDonations, rejectDonation } from '../controllers/adminGivingController.js';
import { listAdminEvents } from '../controllers/eventController.js';
import { createMedia, deleteMedia, updateMedia, uploadMedia } from '../controllers/mediaController.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireUser } from '../middleware/requireUser.js';
import { createBibleStudyGroup, createDepartment, createOrganization, createProgram, createSchedule, getBibleStudyGroupById, getDepartmentById, listBibleStudyGroups, listDepartments, listOrganizations, listPrograms, promoteProgramToEvent, setScheduleOverride, updateProgram } from '../controllers/programController.js';
import { registerStaff, activateAccount } from '../controllers/adminRegistrationController.js';
import { findFollowupLinkCandidates, linkFollowupToVerifiedMember, listFollowupAssignees, listNewChristianFollowups, retryMemberWelcome, retryNewChristianWelcome, updateNewChristianFollowup } from '../controllers/newChristianController.js';
import { createEmailTemplate, listEmailTemplates, previewEmailTemplate, updateEmailTemplate } from '../controllers/messageTemplateController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      callback(new Error('Only JPG, PNG, WebP, and GIF files are supported.'));
      return;
    }
    callback(null, true);
  },
});

const router = Router();
router.use(requireUser);
router.get('/roles', requirePermission('roles.manage'), roles);
router.get('/permissions', requirePermission('roles.manage'), listPermissions);
router.post('/roles', requirePermission('roles.create'), createRole);
router.patch('/roles/:id', requirePermission('roles.edit'), updateRole);
router.put('/roles/:id/permissions', requirePermission('roles.permissions.manage'), setRolePermissions);
router.delete('/roles/:id', requirePermission('roles.manage'), deleteRole);
router.get('/departments', requirePermission('staff.manage'), listDepartments);
router.post('/departments', requirePermission('staff.manage'), createDepartment);
router.get('/organizations', requirePermission('staff.manage'), listOrganizations);
router.post('/organizations', requirePermission('staff.manage'), createOrganization);
router.get('/programs', requirePermission('programs.manage'), listPrograms);
router.get('/events', requirePermission('events.manage'), listAdminEvents);
router.get('/new-christian-followups', requirePermission('membership.manage'), listNewChristianFollowups);
router.get('/new-christian-followups/assignees', requirePermission('membership.manage'), listFollowupAssignees);
router.get('/new-christian-followups/:id/link-candidates', requirePermission('membership.manage'), findFollowupLinkCandidates);
router.patch('/new-christian-followups/:id', requirePermission('membership.manage'), updateNewChristianFollowup);
router.post('/new-christian-followups/:id/link-member', requirePermission('membership.manage'), linkFollowupToVerifiedMember);
router.post('/new-christian-followups/:id/retry-welcome', requirePermission('membership.manage'), retryNewChristianWelcome);
router.post('/programs', requirePermission('programs.manage'), createProgram);
router.patch('/programs/:id', requirePermission('programs.manage'), updateProgram);
router.post('/programs/:id/promote', requirePermission('programs.manage'), promoteProgramToEvent);
router.post('/programs/:id/schedules', requirePermission('programs.manage'), createSchedule);
router.put('/program-schedules/:id/overrides/:date', requirePermission('programs.manage'), setScheduleOverride);
router.post('/bible-study-groups', requirePermission('programs.manage'), createBibleStudyGroup);
router.get('/bible-study-groups', requirePermission('programs.manage'), listBibleStudyGroups);
router.post('/users/:userId/roles', requirePermission('roles.manage'), setUserRoles);
router.post('/users/:userId/retry-welcome', requirePermission('users.manage'), retryMemberWelcome);
router.patch('/users/:userId/status', requirePermission('users.manage'), updateUserStatus);
router.get('/settings', requirePermission('settings.manage'), settings);
router.patch('/settings', requirePermission('settings.manage'), updateSettings);
router.get('/giving', requirePermission('finance.manage'), listDonations);
router.patch('/giving/:id/approve', requirePermission('finance.manage'), approveDonation);
router.patch('/giving/:id/reject', requirePermission('finance.manage'), rejectDonation);
router.get('/audit-logs', requirePermission('audit.read'), auditLogs);
router.get('/reports/:type', requirePermission('reports.read'), report);
router.put('/verse', requirePermission('bible.publish'), publishVerse);
router.get('/verses', requirePermission('bible.publish'), listVersePublications);
router.patch('/verses/:id', requirePermission('bible.publish'), updateVersePublication);
router.delete('/verses/:id', requirePermission('bible.publish'), archiveVersePublication);
router.post('/announcements', requirePermission('announcements.manage'), createAnnouncement);
router.get('/announcements', requirePermission('announcements.manage'), listAnnouncements);
router.patch('/announcements/:id', requirePermission('announcements.manage'), updateAnnouncement);
router.get('/notifications', requirePermission('notifications.manage'), listWebsiteNotifications);
router.post('/notifications', requirePermission('notifications.create'), createWebsiteNotification);
router.patch('/notifications/:id', requirePermission('notifications.edit'), archiveWebsiteNotification);
router.post('/communications/test', requirePermission('notifications.test', 'system.owner.manage'), testCommunication);
router.get('/message-templates', requirePermission('announcements.manage'), listEmailTemplates);
router.post('/message-templates', requirePermission('announcements.manage'), createEmailTemplate);
router.post('/message-templates/preview', requirePermission('announcements.manage'), previewEmailTemplate);
router.patch('/message-templates/:id', requirePermission('announcements.manage'), updateEmailTemplate);
router.post('/media/upload', requirePermission('media.manage', 'announcements.manage', 'notifications.create', 'notifications.manage'), (request, response, next) => {
  upload.single('image')(request, response, (error) => {
    if (error) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      response.status(status).json({ error: error.message || 'The selected image could not be processed.' });
      return;
    }
    next();
  });
}, uploadMedia);
router.post('/media', requirePermission('media.manage', 'announcements.manage'), createMedia);
router.patch('/media/:id', requirePermission('media.manage', 'announcements.manage'), updateMedia);
router.delete('/media/:id', requirePermission('media.manage', 'announcements.manage'), deleteMedia);
router.post('/registrations', requirePermission('users.create'), registerStaff);
router.post('/activate-account', requirePermission('users.create'), activateAccount);
router.get('/departments/:id', requirePermission('departments.view'), getDepartmentById);
router.get('/bible-study-groups/:id', requirePermission('departments.view'), getBibleStudyGroupById);
router.post('/telegram/messages/:id/replies', requirePermission('telegram.manage'), replyToTelegramMessage);
router.patch('/telegram/messages/:id', requirePermission('telegram.manage'), updateTelegramMessage);
router.get('/telegram/messages', requirePermission('telegram.manage'), telegramInbox);
export default router;
