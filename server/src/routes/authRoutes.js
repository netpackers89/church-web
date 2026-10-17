import { Router } from 'express';
import { createHash } from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { forgotPassword, getAuthIdentity, keepCurrentPassword, login, logout, register, resetPassword, verifyResetOtp } from '../controllers/authController.js';
import { requireUser } from '../middleware/requireUser.js';

const router = Router();
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 12,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
});
const accountLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 6,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	keyGenerator: (request) => {
		const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
		return email ? `account:${createHash('sha256').update(email).digest('hex')}` : `ip:${ipKeyGenerator(request.ip)}`;
	},
	message: { error: 'Too many attempts for this account. Try again later.' },
});

router.post('/register', authLimiter, accountLimiter, register);
router.post('/login', authLimiter, accountLimiter, login);
// These endpoints deliberately return the same confirmation for known and
// unknown email addresses.  Tighter limits protect the email provider too.
router.post('/forgot-password', authLimiter, accountLimiter, forgotPassword);
router.post('/verify-reset-otp', authLimiter, accountLimiter, verifyResetOtp);
router.post('/reset-password', authLimiter, accountLimiter, resetPassword);
router.post('/keep-current-password', authLimiter, accountLimiter, keepCurrentPassword);
router.post('/logout', requireUser, logout);
router.get('/me', requireUser, getAuthIdentity);

export default router;
