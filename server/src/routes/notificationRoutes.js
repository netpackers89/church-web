import { Router } from 'express';
import {
	getNotificationStatus,
	sendToRecipients,
} from '../controllers/notificationController.js';
import { requireAdminApiKey } from '../middleware/requireAdminApiKey.js';

const router = Router();

router.get('/status', getNotificationStatus);
router.post('/send', requireAdminApiKey, sendToRecipients);

export default router;
