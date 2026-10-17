import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import {
	createMyTelegramLinkToken,
	getUsers,
	getMyProfile,
	getMyTelegramLinkStatus,
	listMyNotifications,
	markMyNotificationRead,
	listMyGiving,
	requestEmailChange,
	submitMyGiving,
	unlinkMyTelegram,
	updateMyNotificationPreferences,
	updateMyPassword,
	updateMyProfile,
	uploadMyProfileImage,
	verifyEmailChange,
} from '../controllers/userController.js';
import { requireUser } from '../middleware/requireUser.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { getReceipt } from '../controllers/adminGivingController.js';

const router = Router();
const profileImageUpload = multer({
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
const sensitiveLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { error: 'Too many sensitive account attempts. Try again later.' },
});

router.post('/me/email-change/verify', sensitiveLimiter, verifyEmailChange);
router.use(requireUser);
router.get('/', requirePermission('users.read'), getUsers);
router.get('/me', getMyProfile);
router.get('/me/notifications', listMyNotifications);
router.patch('/me/notifications/:id/read', markMyNotificationRead);
router.get('/me/giving', listMyGiving);
router.get('/me/giving/:id/receipt', getReceipt);
router.post('/me/giving', submitMyGiving);
router.patch('/me', updateMyProfile);
router.post('/me/profile-image', (request, response, next) => {
	profileImageUpload.single('image')(request, response, (error) => {
		if (error) {
			response.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.message || 'The selected image could not be processed.' });
			return;
		}
		next();
	});
}, uploadMyProfileImage);
router.patch('/me/password', sensitiveLimiter, updateMyPassword);
router.post('/me/email-change', sensitiveLimiter, requestEmailChange);
router.patch('/me/notification-preferences', updateMyNotificationPreferences);
router.post('/me/telegram/link-token', createMyTelegramLinkToken);
router.post('/me/telegram/link-status', getMyTelegramLinkStatus);
router.delete('/me/telegram', unlinkMyTelegram);

export default router;
