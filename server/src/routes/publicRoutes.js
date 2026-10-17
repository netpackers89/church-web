import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { getRegistrationOptions } from '../controllers/userController.js';
import { createFollowupTelegramLink, followupTelegramStatus } from '../controllers/newChristianController.js';
import { dailyVerse, getBankAccount, getBibleStudyGroup, getDepartment, getEvent, getOrganization, listAnnouncements, listBanners, listBibleStudyGroups, listBibleVerses, listCampaigns, listEvents, listGivingCategories, listOrganizations, listPartners, listSermons, nextGathering, organizationDepartments, schedules, submitContact, submitNewChristian } from '../controllers/publicController.js';

const router = Router();

router.get('/registration-options', getRegistrationOptions);
router.post('/contact', submitContact);
router.post('/new-christian', submitNewChristian);
router.post('/new-christian/telegram/link-token', createFollowupTelegramLink);
router.post('/new-christian/telegram/status', followupTelegramStatus);

router.get('/events', listEvents);
router.get('/events/next-gathering', nextGathering);
router.get('/events/:id', getEvent);
// Study groups and Scripture are part of the member experience. Keeping this
// guard at the API level prevents direct-link access outside the public UI.
router.get('/bible-study-groups', requireUser, listBibleStudyGroups);
router.get('/bible-study-groups/:id', requireUser, getBibleStudyGroup);
router.get('/campaigns', listCampaigns);
router.get('/sermons', listSermons);
router.get('/announcements', listAnnouncements);
router.get('/banners', listBanners);
router.get('/ministries', listOrganizations);
router.get('/partners', listPartners);

router.get('/verse', requireUser, dailyVerse);
router.get('/verses', requireUser, listBibleVerses);
router.get('/program-schedules', schedules);

router.get('/organizations', listOrganizations);
router.get('/organizations/:id/departments', organizationDepartments);
router.get('/organizations/:id', getOrganization);
router.get('/departments/:id', getDepartment);
router.get('/bank-account', getBankAccount);
router.get('/giving-categories', listGivingCategories);

export default router;
