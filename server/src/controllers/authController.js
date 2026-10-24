import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { createUser, findUserByEmail, findUserById, invalidateUserSessions, pool } from '../config/db.js';
import { config } from '../config/env.js';
import { sendEmailNotification } from '../email/index.js';
import { createMemberWelcomeNotification, sendMemberWelcomeEmail } from '../services/memberWelcomeService.js';
import { getEthiopianBirthDetails, getGregorianBirthDetails } from '../utils/ethiopianCalendar.js';
import { isSafeImageUrl } from '../services/imgbbService.js';

export const LOCATION_OPTIONS = [
	'Gedera (Church Location)', 'Tafo Adebabaye', 'Yeka Abado Kela', 'G7', '13',
	'Arcema', 'Zoble Mikayele', 'Ayat Tafo', 'Lega Tafo', '140', 'Gari Tera', 'Other',
];
export const LANGUAGE_OPTIONS = [
	{ code: 'en', label: 'English' },
	{ code: 'am', label: 'Amharic' },
	{ code: 'om', label: 'Afaan Oromoo' },
	{ code: 'ti', label: 'Tigrinya' },
];

function validationError(message) {
	return Object.assign(new Error(message), { status: 400 });
}

function normalizePhone(value) {
	if (typeof value !== 'string') throw validationError('A valid phone number is required.');
	let phone = value.replace(/[\s()-]/g, '');
	if (/^0[79]\d{8}$/.test(phone)) phone = `+251${phone.slice(1)}`;
	if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
		throw validationError('Enter a valid phone number in international format, for example +251912345678.');
	}
	return phone;
}

async function getAllowedLocationOptions() {
	try {
		const result = await pool.query("SELECT DISTINCT btrim(name) AS name FROM program_locations WHERE name IS NOT NULL AND btrim(name) <> '' ORDER BY name");
		return [...new Set([...LOCATION_OPTIONS.filter((location) => location !== 'Other'), ...result.rows.map((row) => row.name), 'Other'])];
	} catch {
		return LOCATION_OPTIONS;
	}
}

function validateLocation(location, otherLocation, allowedLocations = LOCATION_OPTIONS) {
	if (!allowedLocations.includes(location)) throw validationError('Select a valid residential location.');
	if (location === 'Other') {
		if (typeof otherLocation !== 'string' || !otherLocation.trim() || otherLocation.trim().length > 120) {
			throw validationError('Enter your residential location.');
		}
		return otherLocation.trim();
	}
	if (otherLocation) throw validationError('otherLocation is only allowed when location is Other.');
	return null;
}

function cookieOptions() {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production' || config.cookieSameSite === 'none',
		sameSite: config.cookieSameSite,
		path: '/',
		maxAge: 7 * 24 * 60 * 60 * 1000,
	};
}

function setSessionCookie(response, userId, sessionVersion) {
	if (!config.jwtSecret || config.jwtSecret.length < 32) throw Object.assign(new Error('Authentication requires a JWT_SECRET of at least 32 characters in server/.env.'), { status: 503 });
	const token = jwt.sign({ sessionVersion }, config.jwtSecret, {
		subject: String(userId),
		issuer: 'church-management-api',
		expiresIn: '7d',
	});
	response.cookie('church_session', token, cookieOptions());
}

function handleError(response, error) {
	if (error.status) return response.status(error.status).json({ error: error.message });
	if (error instanceof RangeError) return response.status(400).json({ error: error.message });
	if (error.code === '23505') {
		return response.status(409).json({ error: 'An account with that email address or phone number already exists.' });
	}
	console.error('[auth] request failed:', error.message);
	return response.status(503).json({ error: 'The account service is temporarily unavailable.' });
}

const RESET_CONFIRMATION = 'If an account exists for this email address, a password reset code has been sent.';
const OTP_ATTEMPT_LIMIT = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizedEmail(value) {
	const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
	if (!EMAIL_PATTERN.test(email) || email.length > 320) throw validationError('Enter a valid email address.');
	return email;
}

function validPassword(password, confirmation) {
	if (typeof password !== 'string' || password.length < 10 || password.length > 128 || Buffer.byteLength(password, 'utf8') > 72) {
		throw validationError('Password must be between 10 and 128 characters.');
	}
	if (confirmation !== password) throw validationError('Password and confirmation do not match.');
}

function resetTokenHash(token) {
	return createHash('sha256').update(token).digest('hex');
}

function passwordResetEmail(code) {
	const name = config.branding.churchName;
	return {
		subject: `${name}: password reset code`,
		text: `Your ${name} password reset code is ${code}. It expires in 5 minutes. If you did not request this, you can safely ignore this email.`,
		html: `<p>Your <strong>${name}</strong> password reset code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p><p>This code expires in 5 minutes. If you did not request this, you can safely ignore this email.</p>`,
	};
}

export async function forgotPassword(request, response) {
	try {
		const email = normalizedEmail(request.body?.email);
		const user = await findUserByEmail(email);
		if (!user || user.account_status !== 'ACTIVE') return response.json({ message: RESET_CONFIRMATION });

		const otp = String(randomInt(100000, 1000000));
		const otpHash = await bcrypt.hash(otp, 12);
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			// Lock the account row so concurrent requests cannot leave two valid codes.
			await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
			await client.query(`UPDATE password_reset_requests
				SET invalidated_at=NOW() WHERE user_id=$1 AND purpose='PASSWORD_RESET'
				AND used_at IS NULL AND invalidated_at IS NULL`, [user.id]);
			await client.query(`INSERT INTO password_reset_requests(user_id,otp_hash,expires_at)
				VALUES($1,$2,NOW() + INTERVAL '5 minutes')`, [user.id, otpHash]);
			await client.query('COMMIT');
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally { client.release(); }

		// Email occurs only after the reset record is committed. Do not surface a
		// provider failure as account-existence information.
		try { await sendEmailNotification({ to: user.email, ...passwordResetEmail(otp) }); }
		catch (error) { console.error('[auth] password reset email failed:', error.message); }
		return response.json({ message: RESET_CONFIRMATION });
	} catch (error) { return handleError(response, error); }
}

export async function verifyResetOtp(request, response) {
	try {
		const email = normalizedEmail(request.body?.email);
		const otp = typeof request.body?.otp === 'string' ? request.body.otp.replace(/\s/g, '') : '';
		if (!/^\d{6}$/.test(otp)) throw validationError('Enter the six-digit reset code.');
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const result = await client.query(`SELECT r.id,r.otp_hash,r.verification_attempts
				FROM password_reset_requests r JOIN users u ON u.id=r.user_id
				WHERE LOWER(u.email)=LOWER($1) AND u.account_status='ACTIVE'
				AND r.purpose='PASSWORD_RESET' AND r.used_at IS NULL AND r.invalidated_at IS NULL
				AND r.expires_at > NOW()
				ORDER BY r.created_at DESC LIMIT 1 FOR UPDATE`, [email]);
			if (!result.rowCount) throw Object.assign(new Error('This reset code is invalid or has expired. Request a new code.'), { status: 400 });
			const reset = result.rows[0];
			if (reset.verification_attempts >= OTP_ATTEMPT_LIMIT || !(await bcrypt.compare(otp, reset.otp_hash))) {
				const attempts = Number(reset.verification_attempts) + 1;
				await client.query(`UPDATE password_reset_requests SET verification_attempts=$2,
					invalidated_at=CASE WHEN $2 >= $3 THEN NOW() ELSE invalidated_at END WHERE id=$1`, [reset.id, attempts, OTP_ATTEMPT_LIMIT]);
				await client.query('COMMIT');
				return response.status(400).json({ error: attempts >= OTP_ATTEMPT_LIMIT ? 'Too many incorrect codes. Request a new code.' : 'This reset code is incorrect.' });
			}
			const authorization = randomBytes(32).toString('base64url');
			await client.query(`UPDATE password_reset_requests SET verified_at=NOW(),reset_token_hash=$2,
				reset_expires_at=NOW() + INTERVAL '10 minutes' WHERE id=$1`, [reset.id, resetTokenHash(authorization)]);
			await client.query('COMMIT');
			return response.json({ message: 'Code verified. Choose a new password.', resetToken: authorization, expiresInSeconds: 600 });
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally { client.release(); }
	} catch (error) { return handleError(response, error); }
}

export async function resetPassword(request, response) {
	try {
		const token = typeof request.body?.resetToken === 'string' ? request.body.resetToken : '';
		if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw validationError('Your password reset authorization is invalid or expired.');
		validPassword(request.body?.newPassword, request.body?.confirmPassword);
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const reset = await client.query(`SELECT id,user_id FROM password_reset_requests
				WHERE reset_token_hash=$1 AND verified_at IS NOT NULL AND used_at IS NULL
				AND invalidated_at IS NULL AND reset_expires_at > NOW() FOR UPDATE`, [resetTokenHash(token)]);
			if (!reset.rowCount) throw Object.assign(new Error('Your password reset authorization is invalid or expired. Request a new code.'), { status: 400 });
			const passwordHash = await bcrypt.hash(request.body.newPassword, 12);
			await client.query('UPDATE users SET password_hash=$2,session_version=session_version+1,updated_at=NOW() WHERE id=$1', [reset.rows[0].user_id, passwordHash]);
			await client.query('UPDATE password_reset_requests SET used_at=NOW(),reset_token_hash=NULL WHERE id=$1', [reset.rows[0].id]);
			await client.query(`UPDATE password_reset_requests SET invalidated_at=NOW()
				WHERE user_id=$1 AND id<>$2 AND used_at IS NULL AND invalidated_at IS NULL`, [reset.rows[0].user_id, reset.rows[0].id]);
			await client.query('COMMIT');
			return response.json({ message: 'Your password has been reset. Please sign in with your new password.' });
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally { client.release(); }
	} catch (error) { return handleError(response, error); }
}

export async function keepCurrentPassword(request, response) {
	try {
		const token = typeof request.body?.resetToken === 'string' ? request.body.resetToken : '';
		if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw validationError('Your password reset authorization is invalid or expired.');
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const reset = await client.query(`SELECT id FROM password_reset_requests
				WHERE reset_token_hash=$1 AND verified_at IS NOT NULL AND used_at IS NULL
				AND invalidated_at IS NULL AND reset_expires_at > NOW() FOR UPDATE`, [resetTokenHash(token)]);
			if (!reset.rowCount) throw Object.assign(new Error('Your password reset authorization is invalid or expired. Request a new code.'), { status: 400 });
			await client.query('UPDATE password_reset_requests SET used_at=NOW(),reset_token_hash=NULL WHERE id=$1', [reset.rows[0].id]);
			await client.query('COMMIT');
			return response.json({ message: 'Your current password has not been changed.' });
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally { client.release(); }
	} catch (error) { return handleError(response, error); }
}

export async function register(request, response) {
	try {
		if (!config.jwtSecret || config.jwtSecret.length < 32) throw Object.assign(new Error('Authentication requires a JWT_SECRET of at least 32 characters in server/.env.'), { status: 503 });
		const body = request.body ?? {};
		const suppliedNameParts = ['firstName', 'fatherName', 'grandfatherName'].some((field) => body[field] !== undefined);
		const nameParts = ['firstName', 'fatherName', 'grandfatherName'].map((field) => typeof body[field] === 'string' ? body[field].trim() : '');
		const name = suppliedNameParts ? nameParts.join(' ') : (typeof body.name === 'string' ? body.name.trim() : '');
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		const password = body.password;
		if (name.length < 2 || name.length > 160) throw validationError('Full name must be between 2 and 160 characters.');
		if (suppliedNameParts && nameParts.some((part) => !part || part.length > 80)) throw validationError('Enter your first, father, and grandfather names (80 characters or fewer each).');
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw validationError('Enter a valid email address.');
		if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
			throw validationError('Password must be between 10 and 128 characters.');
		}
		if (Buffer.byteLength(password, 'utf8') > 72) throw validationError('Password must be no more than 72 UTF-8 bytes.');
		if (body.confirmPassword !== password) throw validationError('Password and confirmation do not match.');
		if (body.privacyAccepted !== true) throw validationError('Accept the privacy policy to register.');
		const phone = normalizePhone(body.phone);
		const maritalStatus = body.maritalStatus;
		if (!['Single', 'Married', 'Rather not say'].includes(maritalStatus)) {
			throw validationError('Select a valid marital status.');
		}
		const hasEthiopianBirthDate = body.birthDateEc !== undefined && body.birthDateEc !== null && body.birthDateEc !== '';
		const hasGregorianBirthDate = body.birthDateGregorian !== undefined && body.birthDateGregorian !== null && body.birthDateGregorian !== '';
		if (hasEthiopianBirthDate === hasGregorianBirthDate) throw validationError('Provide a birth date in either the Ethiopian or Gregorian calendar.');
		const birth = hasGregorianBirthDate
			? getGregorianBirthDetails(body.birthDateGregorian, config.churchTimezone)
			: getEthiopianBirthDetails(body.birthDateEc, config.churchTimezone);
		const locationOptions = await getAllowedLocationOptions();
		const otherLocation = validateLocation(body.location, body.otherLocation, locationOptions);
		let profileImageUrl = null;
		if (body.profileImageUrl !== undefined && body.profileImageUrl !== '') {
			if (typeof body.profileImageUrl !== 'string' || !isSafeImageUrl(body.profileImageUrl, config.mediaAllowedHosts)) {
				throw validationError('Use a valid HTTPS profile image URL from an approved media host.');
			}
			profileImageUrl = body.profileImageUrl.trim();
		}
		const notifyEmail = typeof body.notifyEmail === 'boolean' ? body.notifyEmail : true;
		const preferredLanguage = body.preferredLanguage ?? body.preferred_language ?? 'en';
		if (!LANGUAGE_OPTIONS.some(({ code }) => code === preferredLanguage)) throw validationError('Select a supported preferred language.');
		const passwordHash = await bcrypt.hash(password, 12);
		const user = await createUser({
			name,
			firstName: suppliedNameParts ? nameParts[0] : null,
			fatherName: suppliedNameParts ? nameParts[1] : null,
			grandfatherName: suppliedNameParts ? nameParts[2] : null,
			email,
			phone,
			passwordHash,
			birthDateEc: birth.ethiopian,
			birthDateGregorian: birth.gregorian,
			location: body.location,
			maritalStatus,
			otherLocation,
			profileImageUrl,
			notifyEmail,
			preferredLanguage,
		});
		const inAppDelivery = await createInAppWelcome(user);
		const emailDelivery = notifyEmail ? await sendWelcome(user) : { status: 'skipped', reason: 'Email notifications are disabled.' };
		return response.status(201).json({
			message: 'Registration complete. You can sign in now.',
			user: { ...user, age: birth.age, telegramConnected: false },
			notifications: { inApp: inAppDelivery, email: emailDelivery, telegram: { status: 'skipped', reason: 'Connect Telegram after signing in.' } },
		});
	} catch (error) {
		return handleError(response, error);
	}
}

async function createInAppWelcome(user) {
	try {
		return await createMemberWelcomeNotification(user);
	} catch (error) {
		console.error('[auth] in-app welcome notification failed:', error.message);
		return { status: 'failed', reason: 'Registration succeeded, but the in-app welcome notification could not be saved.' };
	}
}

async function sendWelcome(user) {
	try {
		const delivery = await sendMemberWelcomeEmail(user);
		return delivery.status === 'DELIVERED'
			? { status: 'delivered', details: delivery.details }
			: { status: delivery.status.toLowerCase(), reason: delivery.error ?? 'The welcome email is already pending.' };
	} catch (error) {
		console.error('[auth] welcome email failed:', error.message);
		return { status: 'failed', error: 'Registration succeeded, but the welcome email could not be delivered.' };
	}
}

export async function login(request, response) {
	try {
		if (!config.jwtSecret || config.jwtSecret.length < 32) throw Object.assign(new Error('Authentication requires a JWT_SECRET of at least 32 characters in server/.env.'), { status: 503 });
		const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
		const password = request.body?.password;
		if (!email || typeof password !== 'string') throw validationError('Email and password are required.');
		const user = await findUserByEmail(email);
		if (!user || !(await bcrypt.compare(password, user.password_hash)) || user.account_status !== 'ACTIVE') {
			return response.status(401).json({ error: 'Email or password is incorrect.' });
		}
		setSessionCookie(response, user.id, user.session_version);
		return response.json({ message: 'Signed in successfully.' });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function logout(request, response) {
	await invalidateUserSessions(request.user.id);
	response.clearCookie('church_session', { ...cookieOptions(), maxAge: undefined });
	return response.json({ message: 'Signed out successfully.' });
}

export async function getAuthIdentity(request, response) {
	try {
		const user = await findUserById(request.user.id);
		if (!user || user.accountStatus !== 'ACTIVE') return response.status(401).json({ error: 'Account unavailable.' });
		const [departments, bibleStudyGroups, organizations] = await Promise.all([
			pool.query(`SELECT DISTINCT d.id::text AS id,d.name,d.organization_id::text AS "organizationId"
				FROM departments d LEFT JOIN department_members dm ON dm.department_id=d.id
				WHERE (d.leader_user_id=$1 OR (dm.user_id=$1 AND UPPER(dm.role) IN ('LEADER','MANAGER')))
				AND d.is_active=TRUE AND d.deleted_at IS NULL ORDER BY d.name`, [request.user.id]),
			pool.query(`SELECT DISTINCT g.id::text AS id,g.name
				FROM bible_study_groups g LEFT JOIN bible_study_memberships bm ON bm.bible_study_group_id=g.id
				WHERE (g.leader_user_id=$1 OR (bm.user_id=$1 AND UPPER(bm.role) IN ('LEADER','MANAGER')))
				AND g.is_active=TRUE AND g.deleted_at IS NULL ORDER BY g.name`, [request.user.id]),
			pool.query(`SELECT DISTINCT o.id::text AS id,o.name
				FROM organizations o JOIN departments d ON d.organization_id=o.id
				LEFT JOIN department_members dm ON dm.department_id=d.id
				WHERE (d.leader_user_id=$1 OR (dm.user_id=$1 AND UPPER(dm.role) IN ('LEADER','MANAGER')))
				AND o.is_active=TRUE AND o.deleted_at IS NULL AND d.deleted_at IS NULL ORDER BY o.name`, [request.user.id]),
		]);
		return response.json({ success: true, data: {
			id: user.id, name: user.name, email: user.email, role: user.role,
			roles: request.user.roles, permissions: request.user.permissions,
			managedDepartments: departments.rows,
			managedBibleStudyGroups: bibleStudyGroups.rows,
			managedOrganizations: organizations.rows,
		} });
	} catch (error) {
		return handleError(response, error);
	}
}
