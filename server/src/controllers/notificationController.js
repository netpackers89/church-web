import { getProviderStatus } from '../services/notificationStatus.js';
import { findRecipients } from '../models/notificationModel.js';
import { sendMessageToRecipient } from '../services/recipientNotificationService.js';
import { config } from '../config/env.js';
import { isSafeImageUrl } from '../services/imgbbService.js';

function optionalText(value, field, maxLength) {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value !== 'string' || value.trim().length > maxLength) {
		throw Object.assign(new Error(`${field} must be text no longer than ${maxLength} characters.`), { status: 400 });
	}
	return value.trim();
}

function requiredText(value, field, maxLength) {
	const text = optionalText(value, field, maxLength);
	if (!text) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
	return text;
}

function sendFailure(response, error) {
	if (error.status) return response.status(error.status).json({ error: error.message });
	if (error.code === '23505') {
		return response.status(409).json({ error: 'That email address or Telegram chat ID is already registered.' });
	}
	console.error('[notifications] database request failed:', error.message);
	return response.status(503).json({ error: 'Database unavailable. Check PostgreSQL settings in server/.env.' });
}

export function getNotificationStatus(_request, response) {
	response.json({ providers: getProviderStatus() });
}

export async function sendToRecipients(request, response) {
	try {
		const { recipientIds, groupName } = request.body ?? {};
		const hasIds = Array.isArray(recipientIds) && recipientIds.length > 0;
		const hasGroup = typeof groupName === 'string' && groupName.trim().length > 0;
		if (hasIds === hasGroup) {
			throw Object.assign(new Error('Provide either recipientIds or groupName.'), { status: 400 });
		}
		if (hasIds && (recipientIds.length > 100 || recipientIds.some((id) => !/^\d+$/.test(String(id)) || Number(id) < 1))) {
			throw Object.assign(new Error('recipientIds must contain 1 to 100 positive integer IDs.'), { status: 400 });
		}

		const message = requiredText(request.body?.message, 'message', 4000);
		const subject = optionalText(request.body?.subject, 'subject', 200) ?? 'A message from Church Admin';
		const bannerUrl = optionalText(request.body?.bannerUrl, 'bannerUrl', 500);
		if (bannerUrl && !isSafeImageUrl(bannerUrl, config.mediaAllowedHosts)) {
			throw Object.assign(new Error('bannerUrl must be an HTTPS image URL from configured media storage.'), { status: 400 });
		}
		if (bannerUrl && message.length > 800) {
			throw Object.assign(new Error('Image notifications must use a short message of 800 characters or fewer.'), { status: 400 });
		}
		const actionUrl = optionalText(request.body?.actionUrl, 'actionUrl', 500);
		if (actionUrl) {
			try {
				if (new URL(actionUrl).protocol !== 'https:') throw new Error();
			} catch {
				throw Object.assign(new Error('actionUrl must be a valid HTTPS URL.'), { status: 400 });
			}
		}
		const buttonLabel = optionalText(request.body?.buttonLabel, 'buttonLabel', 64);
		const channels = request.body?.channels;
		if (channels !== undefined && (!Array.isArray(channels) || channels.length === 0
			|| channels.some((channel) => !['email', 'telegram'].includes(channel)))) {
			throw Object.assign(new Error('channels must contain email, telegram, or both.'), { status: 400 });
		}

		const recipients = await findRecipients({
			recipientIds: hasIds ? [...new Set(recipientIds.map(String))] : null,
			groupName: hasGroup ? groupName.trim() : null,
		});
		if (recipients.length === 0) return response.status(404).json({ error: 'No registered recipients matched.' });

		const results = await Promise.all(recipients.map(async (recipient) => ({
			recipientId: recipient.id,
			name: recipient.name,
			deliveries: await sendMessageToRecipient(recipient, message, subject, channels, { bannerUrl, actionUrl, buttonLabel }),
		})));
		return response.json({ count: results.length, results });
	} catch (error) {
		return sendFailure(response, error);
	}
}
