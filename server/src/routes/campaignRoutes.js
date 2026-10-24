import { Router } from 'express';
import { archiveCampaign, createCampaign, getAdminCampaign, listAdminCampaigns, updateCampaign } from '../controllers/campaignController.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireUser } from '../middleware/requireUser.js';

const router = Router();
router.use(requireUser, requirePermission('finance.manage'));
router.get('/', listAdminCampaigns);
router.get('/:id', getAdminCampaign);
router.post('/', createCampaign);
router.patch('/:id', updateCampaign);
router.delete('/:id', archiveCampaign);
export default router;
