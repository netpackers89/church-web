import axios from 'axios';
import { config } from '../../config/env.js';

const retryableNetworkCodes = new Set([
	'ECONNABORTED',
	'ECONNREFUSED',
	'ECONNRESET',
	'EAI_AGAIN',
	'ENETUNREACH',
	'ETIMEDOUT',
]);

function isRetryableError(error) {
	const codes = [error.code, error.cause?.code, ...(error.errors ?? []).map((item) => item.code)];
	return codes.some((code) => retryableNetworkCodes.has(code))
		|| error.response?.status === 429
		|| (error.response?.status >= 500 && error.response?.status <= 599);
}

function wait(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeInlineKeyboard(buttons) {
	const rows = Array.isArray(buttons)
		? buttons.slice(0, 8).flatMap((button) => {
			if (typeof button?.text !== 'string' || !button.text.trim() || typeof button.url !== 'string') return [];
			try {
				const url = new URL(button.url);
				if (url.protocol !== 'https:') return [];
				return [[{ text: button.text.trim().slice(0, 64), url: url.href }]];
			} catch {
				return [];
			}
		})
		: [];
	return rows.length ? { inline_keyboard: rows } : undefined;
}

async function telegramRequest(method, payload) {
	if (!config.telegram.token) {
		throw new Error('Telegram provider is not configured: TELEGRAM_BOT_TOKEN.');
	}
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const response = await axios.post(
				`https://api.telegram.org/bot${config.telegram.token}/${method}`,
				payload,
				{ timeout: 20000 },
			);
			if (!response.data?.ok) {
				throw new Error(response.data?.description ?? 'Telegram rejected the message.');
			}
			return response.data.result;
		} catch (error) {
			if (attempt === 3 || !isRetryableError(error)) throw error;
			const delay = 500 * (2 ** (attempt - 1));
			console.warn(`[notifications] Telegram request failed transiently; retrying in ${delay}ms (attempt ${attempt + 1}/3).`);
			await wait(delay);
		}
	}
	throw new Error('Telegram delivery failed without a provider response.');
}

export async function sendTelegramNotification({ chatId, text, photoUrl, buttons, parseMode }) {
	if (!chatId || typeof text !== 'string' || !text.trim()) {
		throw new Error('Telegram delivery requires a chat ID and message text.');
	}
	if (photoUrl) {
		let parsedPhoto;
		try {
			parsedPhoto = new URL(photoUrl);
		} catch {
			throw new Error('Telegram photo URL must be a valid HTTPS URL.');
		}
		if (parsedPhoto.protocol !== 'https:') throw new Error('Telegram photo URL must be a valid HTTPS URL.');
	}
	const markup = safeInlineKeyboard(buttons);
	const formatting = parseMode === 'HTML' ? { parse_mode: 'HTML' } : {};
	const result = await telegramRequest(photoUrl ? 'sendPhoto' : 'sendMessage', photoUrl
		? { chat_id: chatId, photo: photoUrl, caption: text, ...formatting, ...(markup ? { reply_markup: markup } : {}) }
		: { chat_id: chatId, text, ...formatting, ...(markup ? { reply_markup: markup } : {}) });
	return { messageId: result.message_id, chatId };
}

export async function checkTelegramBotStatus() {
	const [bot, webhook] = await Promise.all([
		telegramRequest('getMe', {}),
		telegramRequest('getWebhookInfo', {}),
	]);
	return {
		bot: {
			id: bot.id,
			name: bot.first_name,
			username: bot.username ?? null,
			canJoinGroups: Boolean(bot.can_join_groups),
			canReadAllGroupMessages: Boolean(bot.can_read_all_group_messages),
		},
		webhook: {
			configured: Boolean(webhook.url),
			pendingUpdates: Number(webhook.pending_update_count ?? 0),
			lastErrorDate: webhook.last_error_date ? new Date(webhook.last_error_date * 1000).toISOString() : null,
			lastErrorMessage: webhook.last_error_message ?? null,
		},
	};
}

export async function sendTelegramDocument({ chatId, document, filename, caption }) {
	if (!chatId || !Buffer.isBuffer(document) || document.length === 0) {
		throw new Error('Telegram document delivery requires a chat ID and a non-empty file buffer.');
	}
	if (document.length > 50 * 1024 * 1024) {
		throw new Error('Telegram document exceeds the 50 MB Bot API limit.');
	}
	const safeFilename = typeof filename === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(filename)
		? filename
		: 'receipt.pdf';
	const body = new FormData();
	body.append('chat_id', String(chatId));
	body.append('document', new Blob([document], { type: 'application/pdf' }), safeFilename);
	if (typeof caption === 'string' && caption.trim()) {
		body.append('caption', caption.slice(0, 1024));
	}
	const result = await telegramRequest('sendDocument', body);
	return { messageId: result.message_id, chatId };
}

export async function sendStartupConfirmation() {
	const { token, chatId } = config.telegram;
	const missing = [
		['TELEGRAM_BOT_TOKEN', token],
		['TELEGRAM_CHAT_ID', chatId],
	].filter(([, value]) => !value).map(([name]) => name);

	if (missing.length) {
		throw new Error(`Telegram provider is not configured: ${missing.join(', ')}.`);
	}

	return sendTelegramNotification({
		chatId,
		text: `Church notifications are working. The server started successfully at ${new Date().toISOString()}.`,
	});
}
