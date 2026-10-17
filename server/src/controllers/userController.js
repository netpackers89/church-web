import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
	connectTelegramByToken,
	createEmailChangeToken,
	createTelegramLinkToken,
	disconnectTelegram,
	findUserById,
	getTelegramLinkStatus,
	listUsers,
	pool,
	updateUserPassword,
	updateUserPreferences,
	updateUserProfile,
	verifyEmailChangeToken,
} from '../config/db.js';
import { config } from '../config/env.js';
import { completeFollowupTelegramLink } from './newChristianController.js';
import { sendMemberWelcomeTelegram } from '../services/memberWelcomeService.js';
import { getEthiopianBirthDetails } from '../utils/ethiopianCalendar.js';
import { sendEmailNotification } from '../services/emailService.js';
import { normalizePaymentMethods, validatePaymentReference } from '../services/paymentMethods.js';
import { isSafeImageUrl, uploadImageToImgbb } from '../services/imgbbService.js';

function fail(message, status = 400) {
	return Object.assign(new Error(message), { status });
}

function normalizePhone(value) {
	if (typeof value !== 'string') throw fail('A valid phone number is required.');
	let phone = value.replace(/[\s()-]/g, '');
	if (/^0[79]\d{8}$/.test(phone)) phone = `+251${phone.slice(1)}`;
	if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw fail('Enter a valid phone number in international format.');
	return phone;
}

async function validateLocation(location, otherLocation) {
	const locations = ['Gedera (Church Location)', 'Tafo Adebabaye', 'Yeka Abado Kela', 'G7', '13', 'Arcema', 'Zoble Mikayele', 'Ayat Tafo', 'Lega Tafo', '140', 'Gari Tera'];
	try {
		const result = await pool.query("SELECT DISTINCT btrim(name) AS name FROM program_locations WHERE name IS NOT NULL AND btrim(name) <> ''");
		locations.push(...result.rows.map((row) => row.name));
	} catch {
	}
	locations.push('Other');
	if (!locations.includes(location)) throw fail('Select a valid residential location.');
	if (location === 'Other') {
		if (typeof otherLocation !== 'string' || !otherLocation.trim() || otherLocation.trim().length > 120) throw fail('Enter your residential location.');
		return otherLocation.trim();
	}
	if (otherLocation) throw fail('otherLocation is only allowed when location is Other.');
	return null;
}

function publicProfile(user) {
	const age = getEthiopianBirthDetails(user.birthDateEc, config.churchTimezone).age;
	const { telegramChatId, ...safeUser } = user;
	return { ...safeUser, age, telegramConnected: Boolean(telegramChatId) };
}

function handleError(response, error) {
	if (error.status) return response.status(error.status).json({ error: error.message });
	if (error instanceof RangeError) return response.status(400).json({ error: error.message });
	if (error.code === '23505' && String(error.constraint ?? '').includes('donations_payment_reference')) return response.status(409).json({ error: 'This transaction reference has already been submitted for that payment provider.' });
	if (error.code === '23505' && String(error.constraint ?? '').includes('donations_single_resubmission')) return response.status(409).json({ error: 'A correction for this rejected submission has already been sent.' });
	if (error.code === '23505') return response.status(409).json({ error: 'An account with that email, phone, or Telegram account already exists.' });
	console.error('[users] request failed:', error.message);
	return response.status(503).json({ error: 'The profile service is temporarily unavailable.' });
}

export async function getMyProfile(request, response) {
	try {
		const user = await findUserById(request.user.id);
		if (!user || user.accountStatus !== 'ACTIVE') return response.status(401).json({ error: 'Account unavailable.' });
		const data = { ...publicProfile(user), roles: request.user.roles, permissions: request.user.permissions };
		return response.json({ success: true, message: 'Profile retrieved successfully', data, user: data });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function getUsers(_request, response) {
	try {
		const users = await listUsers();
		return response.json({ success: true, data: users, meta: { total: users.length } });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function listMyNotifications(request, response) {
	try {
		const result = await pool.query(`SELECT id,title,body,image_url AS "imageUrl",link_url AS "linkUrl",created_at AS "createdAt",read_at AS "readAt" FROM user_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [request.user.id]);
		return response.json({ success: true, data: result.rows });
	} catch (error) { return handleError(response, error); }
}

export async function markMyNotificationRead(request, response) {
	try {
		const id = Number(request.params.id);
		if (!Number.isSafeInteger(id) || id < 1) throw fail('Notification not found.', 404);
		const result = await pool.query(`UPDATE user_notifications
			SET read_at=COALESCE(read_at,NOW()), notification_status='READ', updated_at=NOW()
			WHERE id=$1 AND user_id=$2
			RETURNING id,read_at AS "readAt"`, [id, request.user.id]);
		if (!result.rowCount) throw fail('Notification not found.', 404);
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return handleError(response, error); }
}

export async function updateMyProfile(request, response) {
	try {
		const body = request.body ?? {};
		const protectedFields = ['id', 'userId', 'role', 'permissions', 'accountStatus', 'account_status', 'passwordHash', 'password_hash', 'emailVerified', 'email_verified', 'telegramChatId', 'telegram_chat_id', 'profile_image_url', 'createdAt', 'created_at', 'notifyEmail', 'notifyTelegram'];
		const forbiddenField = protectedFields.find((field) => field in body);
		if (forbiddenField) throw fail(`${forbiddenField} cannot be changed through profile editing.`, 403);
		if ('email' in body) throw fail('Use POST /api/users/me/email-change to change your email address.', 400);
		const fields = {};
		if ('name' in body) {
			if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 160) throw fail('Full name must be between 2 and 160 characters.');
			fields.name = body.name.trim();
		}
		if ('profileImageUrl' in body) {
			if (typeof body.profileImageUrl !== 'string' || !isSafeImageUrl(body.profileImageUrl, config.mediaAllowedHosts)) throw fail('Use a valid HTTPS profile image URL from an approved media host.');
			fields.profileImageUrl = body.profileImageUrl.trim();
		}
		if ('phone' in body) fields.phone = normalizePhone(body.phone);
		if ('birthDateEc' in body) {
			const birthDate = getEthiopianBirthDetails(body.birthDateEc, config.churchTimezone);
			fields.birthDateEc = birthDate.ethiopian;
			fields.birthDateGregorian = birthDate.gregorian;
		}
		if ('location' in body) {
			fields.location = body.location;
			fields.otherLocation = await validateLocation(body.location, body.otherLocation);
		} else if ('otherLocation' in body) {
			throw fail('Send location together with otherLocation.');
		}
		const preferredLanguage = body.preferredLanguage ?? body.preferred_language;
		if (preferredLanguage !== undefined) {
			if (!['en', 'am', 'om', 'ti'].includes(preferredLanguage)) throw fail('Select a supported preferred language.');
			fields.preferredLanguage = preferredLanguage;
		}
		if (!Object.keys(fields).length) throw fail('No supported profile fields were provided.');
		const user = await updateUserProfile(request.user.id, fields);
		const data = publicProfile(user);
		return response.json({ success: true, message: 'Profile updated successfully', data, user: data });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function uploadMyProfileImage(request, response) {
	try {
		if (!request.file) throw fail('Select an image file to upload.');
		if (!config.imgbbApiKey) throw fail('Image uploads are not configured. Ask the church administrator.', 503);
		const uploaded = await uploadImageToImgbb(request.file, config.imgbbApiKey, config.mediaAllowedHosts);
		const result = await pool.query(
			`UPDATE users SET profile_image_url=$2,updated_at=NOW() WHERE id=$1
			 RETURNING profile_image_url AS "profileImageUrl"`,
			[request.user.id, uploaded.url],
		);
		if (!result.rowCount) throw fail('Account unavailable.', 404);
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function updateMyPassword(request, response) {
	try {
		const { currentPassword, newPassword } = request.body ?? {};
		if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 10 || newPassword.length > 128 || Buffer.byteLength(newPassword, 'utf8') > 72) {
			throw fail('Current password is required and new password must be between 10 and 128 characters.');
		}
		const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [request.user.id]);
		if (!result.rowCount || !(await bcrypt.compare(currentPassword, result.rows[0].password_hash))) throw fail('Current password is incorrect.', 401);
		await updateUserPassword(request.user.id, await bcrypt.hash(newPassword, 12));
		return response.json({ message: 'Password updated successfully.' });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function updateMyNotificationPreferences(request, response) {
	try {
		const { notifyEmail, notifyTelegram } = request.body ?? {};
		if (notifyEmail === undefined && notifyTelegram === undefined) throw fail('Provide notifyEmail and/or notifyTelegram.');
		if (notifyEmail !== undefined && typeof notifyEmail !== 'boolean') throw fail('notifyEmail must be a boolean.');
		if (notifyTelegram !== undefined && typeof notifyTelegram !== 'boolean') throw fail('notifyTelegram must be a boolean.');
		const user = await findUserById(request.user.id);
		if (!user) throw fail('Account unavailable.', 404);
		if (notifyTelegram && !user.telegramChatId) throw fail('Connect your Telegram account before enabling Telegram notifications.', 409);
		const preferences = await updateUserPreferences(request.user.id, { notifyEmail, notifyTelegram });
		return response.json({ success: true, message: 'Notification preferences updated', preferences, data: preferences });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function requestEmailChange(request, response) {
	try {
		const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
		const currentPassword = request.body?.currentPassword;
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw fail('Enter a valid new email address.');
		if (typeof currentPassword !== 'string') throw fail('Current password is required to request an email change.');
		const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [request.user.id]);
		if (!userResult.rowCount || !(await bcrypt.compare(currentPassword, userResult.rows[0].password_hash))) throw fail('Current password is incorrect.', 401);
		const token = randomBytes(32).toString('base64url');
		const tokenHash = createHash('sha256').update(token).digest('hex');
		await createEmailChangeToken(request.user.id, email, tokenHash);
		const verificationUrl = new URL('/email-verify', config.webOrigin);
		verificationUrl.searchParams.set('token', token);
		await sendEmailNotification({
			to: email,
			subject: 'Verify your new church account email',
			text: `A request was made to change your church account email. Verify it within 30 minutes: ${verificationUrl.href}\n\nIf you did not request this change, ignore this message.`,
			html: `<p>A request was made to change your church account email.</p><p><a href="${verificationUrl.href}">Verify this email address</a></p><p>This link expires in 30 minutes. If you did not request this change, ignore this message.</p>`,
		});
		return response.json({ success: true, message: 'Verification instructions were sent to the new email address.' });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function verifyEmailChange(request, response) {
	try {
		const token = typeof request.body?.token === 'string' ? request.body.token : '';
		if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw fail('A valid email verification token is required.');
		const tokenHash = createHash('sha256').update(token).digest('hex');
		const userId = await verifyEmailChangeToken(tokenHash);
		const user = await findUserById(userId);
		const data = publicProfile(user);
		return response.json({ success: true, message: 'Email address verified and updated successfully', data, user: data });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function getRegistrationOptions(_request, response) {
	let locations = ['Gedera (Church Location)', 'Tafo Adebabaye', 'Yeka Abado Kela', 'G7', '13', 'Arcema', 'Zoble Mikayele', 'Ayat Tafo', 'Lega Tafo', '140', 'Gari Tera'];
	try {
		const result = await pool.query("SELECT DISTINCT btrim(name) AS name FROM program_locations WHERE name IS NOT NULL AND btrim(name) <> '' ORDER BY name");
		locations = [...new Set([...locations, ...result.rows.map((row) => row.name)])];
	} catch {
	}
	locations.push('Other');
	return response.json({
		success: true,
		data: {
			locations,
			languages: [{ code: 'en', label: 'English' }, { code: 'am', label: 'Amharic' }, { code: 'om', label: 'Afaan Oromoo' }, { code: 'ti', label: 'Tigrinya' }],
			ethiopianMonths: ['Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit', 'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'],
			defaultPreferredLanguage: 'en',
			defaultNotifyEmail: true,
			defaultNotifyTelegram: false,
		},
	});
}

export async function listMyGiving(request, response) {
	try {
		const result = await pool.query(`
			SELECT d.id, d.amount, d.currency, d.status,
			       d.payment_reference AS "paymentReference",
			       d.received_at AS "receivedAt",
			       d.created_at AS "createdAt",
			       d.payment_method_id AS "paymentMethodId",d.payment_provider AS "paymentProvider",
			       d.category_id AS "categoryId",d.campaign_id AS "campaignId",
			       d.contributor_name AS "contributorName",d.donor_note AS "note",d.rejection_reason AS "rejectionReason",
			       d.reviewer_notes AS "reviewerNotes",d.receipt_number AS "receiptNumber",d.supersedes_donation_id AS "supersedesDonationId",
			       c.name AS "categoryName",
			       cp.title AS "campaignTitle"
			FROM donations d
			LEFT JOIN donation_categories c ON c.id = d.category_id
			LEFT JOIN fundraising_campaigns cp ON cp.id = d.campaign_id
			WHERE d.user_id = $1 AND d.deleted_at IS NULL
			ORDER BY d.created_at DESC
		`, [request.user.id]);
		return response.json({ success: true, data: result.rows });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function submitMyGiving(request, response) {
	try {
		const body = request.body ?? {};
		const amount = Number(body.amount ?? 0);
		if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000 || !/^\d+(\.\d{1,2})?$/.test(String(body.amount ?? ''))) throw fail('Enter a valid amount greater than zero with at most two decimal places.', 400);
		if (body.accuracyConfirmed !== true) throw fail('Confirm that the submitted transaction details are accurate.', 400);
		const paymentMethodId = typeof body.paymentMethodId === 'string' ? body.paymentMethodId.trim() : '';
		if (!paymentMethodId) throw fail('Select a configured payment provider.', 400);
		const settingsResult = await pool.query(`SELECT key,value FROM system_settings WHERE key IN ('paymentMethods','bank_account','bankName','accountHolder','accountNumber','bankBranch','transferInstructions','currency')`);
		const paymentSettings = Object.fromEntries(settingsResult.rows.map((row) => [row.key,row.value]));
		const paymentMethod = normalizePaymentMethods(paymentSettings.paymentMethods, paymentSettings).find((item) => item.id === paymentMethodId);
		if (!paymentMethod) throw fail('This payment provider is not currently configured for public giving.', 404);
		const currency = paymentMethod.currency;
		const transferDateInput = typeof body.transferDate === 'string' ? body.transferDate.trim() : '';
		if (!/^\d{4}-\d{2}-\d{2}$/.test(transferDateInput) || Number.isNaN(Date.parse(`${transferDateInput}T12:00:00Z`))) throw fail('Enter a valid payment date.', 400);
		const transferDate = new Date(`${transferDateInput}T12:00:00.000Z`);
		const todayAtChurch = new Intl.DateTimeFormat('en-CA', { timeZone: config.churchTimezone }).format(new Date());
		if (transferDateInput > todayAtChurch) throw fail('Payment date cannot be in the future.', 400);
		const paymentReference = validatePaymentReference(body.paymentReference);
		const categoryId = body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== '' ? Number(body.categoryId) : null;
		const campaignId = body.campaignId !== undefined && body.campaignId !== null && body.campaignId !== '' ? Number(body.campaignId) : null;
		if (categoryId === null && campaignId === null) throw fail('Select a giving category or campaign.', 400);
		if (categoryId !== null && (!Number.isSafeInteger(categoryId) || categoryId < 1)) throw fail('Select a valid giving category.', 400);
		if (campaignId !== null && (!Number.isInteger(campaignId) || campaignId <= 0)) throw fail('Select a valid campaign.', 400);
		let resolvedCategoryId = categoryId;
		if (campaignId !== null) {
			const campaign = await pool.query('SELECT id,category_id FROM fundraising_campaigns WHERE id = $1 AND status = $2', [campaignId, 'ACTIVE']);
			if (!campaign.rowCount) throw fail('The selected campaign is not currently active.', 404);
			if (resolvedCategoryId !== null && campaign.rows[0].category_id !== null && Number(campaign.rows[0].category_id) !== resolvedCategoryId) throw fail('The selected campaign does not belong to the selected giving category.', 400);
			resolvedCategoryId ??= campaign.rows[0].category_id;
		}
		if (resolvedCategoryId !== null) {
			const category = await pool.query('SELECT id FROM donation_categories WHERE id=$1 AND is_active=TRUE', [resolvedCategoryId]);
			if (!category.rowCount) throw fail('The selected giving category is not currently active.', 404);
		}
		const contributorName = typeof body.contributorName === 'string' ? body.contributorName.trim() : '';
		if (contributorName.length > 160) throw fail('Contributor name must be 160 characters or fewer.');
		const note = typeof body.note === 'string' ? body.note.trim() : '';
		if (note.length > 2000) throw fail('Note must be 2,000 characters or fewer.');
		const supersedesDonationId = body.supersedesDonationId === undefined || body.supersedesDonationId === null || body.supersedesDonationId === '' ? null : Number(body.supersedesDonationId);
		if (supersedesDonationId !== null) {
			if (!Number.isSafeInteger(supersedesDonationId) || supersedesDonationId < 1) throw fail('The rejected submission to correct is invalid.');
			const rejectedRecord = await pool.query(`SELECT id FROM donations WHERE id=$1 AND user_id=$2 AND status='REJECTED' AND deleted_at IS NULL`, [supersedesDonationId, request.user.id]);
			if (!rejectedRecord.rowCount) throw fail('You can only correct one of your own rejected contributions.', 404);
		}
		const result = await pool.query(`
			INSERT INTO donations (user_id, category_id, campaign_id, amount, currency, payment_reference, status, recorded_by, received_at, payment_method_id, payment_provider, contributor_name, donor_note, supersedes_donation_id)
			VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $1, $7, $8, $9, $10, $11, $12)
			RETURNING id, amount, currency, status, payment_reference AS "paymentReference", received_at AS "receivedAt", payment_provider AS "paymentProvider", created_at AS "createdAt", supersedes_donation_id AS "supersedesDonationId"
		`, [request.user.id, resolvedCategoryId, campaignId, amount, currency, paymentReference, transferDate, paymentMethod.id, paymentMethod.name, contributorName || null, note || null, supersedesDonationId]);
		return response.status(201).json({
			success: true,
			message: 'Your contribution details have been submitted successfully. Our finance team will review your transaction, usually within 24 hours. You will be notified when the review is completed.',
			data: result.rows[0],
		});
	} catch (error) {
		return handleError(response, error);
	}
}

export async function createMyTelegramLinkToken(request, response) {
	try {
		if (!config.telegram.token || !config.telegram.username) throw fail('Telegram linking is not configured. Ask the church administrator.', 503);
		const token = randomBytes(32).toString('base64url');
		const tokenHash = createHash('sha256').update(token).digest('hex');
		await createTelegramLinkToken(request.user.id, tokenHash);
		const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
		return response.status(201).json({
			token,
			url: `https://t.me/${config.telegram.username}?start=${token}`,
			deepLink: `https://t.me/${config.telegram.username}?start=${token}`,
			expiresAt,
			expiresInSeconds: 300,
			message: 'Open the link and press Start in the official church bot to connect your account.',
		});
	} catch (error) {
		return handleError(response, error);
	}
}

export async function getMyTelegramLinkStatus(request, response) {
	try {
		const token = typeof request.body?.token === 'string' ? request.body.token : '';
		if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw fail('A valid Telegram link token is required.');
		const tokenHash = createHash('sha256').update(token).digest('hex');
		const status = await getTelegramLinkStatus(request.user.id, tokenHash);
		return response.json({ success: true, data: status, ...status });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function unlinkMyTelegram(request, response) {
	try {
		await disconnectTelegram(request.user.id);
		return response.json({ message: 'Telegram account disconnected. Telegram notifications have been disabled.' });
	} catch (error) {
		return handleError(response, error);
	}
}

export async function completeTelegramLink(token, telegramIdentity) {
	const tokenHash = createHash('sha256').update(token).digest('hex');
	try {
		const userId = await connectTelegramByToken(tokenHash, telegramIdentity);
		const delivery = await sendMemberWelcomeTelegram(userId, String(telegramIdentity.chatId));
		return { kind: 'member', userId, welcomeStatus: delivery.status };
	} catch (error) {
		if (error.status !== 400) throw error;
		return completeFollowupTelegramLink(token, telegramIdentity);
	}
}
