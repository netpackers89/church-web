import axios from 'axios';
import { config } from '../config/env.js';

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

export async function sendTelegramNotification({ chatId, text, photoUrl, buttons }) {
	if (!config.telegram.token) {
		throw new Error('Telegram provider is not configured: TELEGRAM_BOT_TOKEN.');
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
	const inlineKeyboard = Array.isArray(buttons)
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
	const replyMarkup = inlineKeyboard.length ? { inline_keyboard: inlineKeyboard } : undefined;

	let response;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const method = photoUrl ? 'sendPhoto' : 'sendMessage';
			const payload = photoUrl
				? { chat_id: chatId, photo: photoUrl, caption: text, parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }
				: { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) };
			response = await axios.post(
				`https://api.telegram.org/bot${config.telegram.token}/${method}`,
				payload,
				{ timeout: 20000 },
			);
			break;
		} catch (error) {
			if (attempt === 3 || !isRetryableError(error)) throw error;
			const delay = 500 * (2 ** (attempt - 1));
			console.warn(`[notifications] Telegram request failed transiently; retrying in ${delay}ms (attempt ${attempt + 1}/3).`);
			await wait(delay);
		}
	}

	if (!response.data?.ok) {
		throw new Error(response.data?.description ?? 'Telegram rejected the message.');
	}

	return { messageId: response.data.result.message_id, chatId };
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
