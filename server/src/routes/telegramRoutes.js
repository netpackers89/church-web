import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { telegramWebhook } from '../controllers/telegramController.js';
import { disconnectMyTelegram } from '../controllers/userController.js';
import { requireUser } from '../middleware/requireUser.js';

const router = Router();
const sensitiveLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { error: 'Too many sensitive account attempts. Try again later.' },
});

router.post('/webhook', telegramWebhook);
router.delete('/disconnect', sensitiveLimiter, requireUser, disconnectMyTelegram);

export default router;
