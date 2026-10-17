import { Bot } from 'node-telegram-bot-api';
import { completeTelegramLink } from '../controllers/userController.js';
import { config } from '../config/env.js';

let bot;

function safeTelegramUrl(value) {
	if (!value) return null;
	try {
		const url = new URL(value);
		return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
	} catch {
		return null;
	}
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
	})[character]);
}

function welcomeMarkup() {
	const buttons = [
		['🌐 Public Website', config.branding.websiteUrl],
		['ℹ️ About Us', config.branding.aboutUrl],
	]
		.map(([text, value]) => ({ text, url: safeTelegramUrl(value) }))
		.filter(({ url }) => url);

	return buttons.length ? { inline_keyboard: [buttons] } : undefined;
}

function welcomeCaption(linked = false) {
	const churchName = escapeHtml(config.branding.churchName);
	const verse = escapeHtml(config.branding.bibleVerse);
	const reference = escapeHtml(config.branding.bibleReference);
	const linkedNote = linked ? '\n\nYour Telegram account is now securely connected to your member profile.' : '';
	return `<b>Welcome to ${churchName}!</b>\n\nWe are glad you are here. Find a church family rooted in faith, fellowship, and hope.\n\n<i>“${verse}”</i>\n${reference}${linkedNote}`;
}

async function sendWelcomeCard(context, linked = false) {
	const replyMarkup = welcomeMarkup();
	const imageUrl = safeTelegramUrl(config.branding.bannerUrl)
		?? safeTelegramUrl(config.branding.logoUrl);
	const caption = welcomeCaption(linked);

	if (imageUrl) {
		try {
			await context.api.sendPhoto({
				chat_id: context.chatId,
				photo: imageUrl,
				caption,
				parse_mode: 'HTML',
				...(replyMarkup ? { reply_markup: replyMarkup } : {}),
			});
			return;
		} catch (error) {
			console.warn('[telegram-bot] welcome image failed; sending text instead:', error.message);
		}
	}

	await context.api.sendMessage({
		chat_id: context.chatId,
		text: caption,
		parse_mode: 'HTML',
		...(replyMarkup ? { reply_markup: replyMarkup } : {}),
	});
}

export function startTelegramBot() {
	if (!config.telegram.token) {
		console.info('[telegram-bot] disabled: TELEGRAM_BOT_TOKEN is not configured.');
		return null;
	}
	if (config.telegramWebhookUrl) {
		console.info('[telegram-bot] webhook mode is configured; polling is disabled.');
		return null;
	}
	if (bot) return bot;

	bot = new Bot(config.telegram.token);
	bot.command('start', async (context) => {
		const token = typeof context.match === 'string' ? context.match.trim() : '';
		if (!token) {
			await sendWelcomeCard(context);
			return;
		}
		if (context.message?.chat?.type !== 'private' || !context.chatId) {
			await context.reply('For your privacy, account linking must be completed in a private chat with this bot.');
			return;
		}
		try {
			const link = await completeTelegramLink(token, {
				telegramUserId: context.message?.from?.id,
				chatId: context.chatId,
				username: context.message?.from?.username,
				displayName: [context.message?.from?.first_name, context.message?.from?.last_name].filter(Boolean).join(' '),
			});
			if (link?.kind === 'followup') {
				await context.reply(link.welcomeStatus === 'DELIVERED'
					? 'Telegram is connected. A welcome message has been sent, and the church follow-up team will be in touch.'
					: 'Telegram is connected. The welcome message could not be delivered, but the church follow-up team can still contact you.');
			} else {
				await context.reply(link?.welcomeStatus === 'DELIVERED'
					? 'Telegram is connected. Your welcome message has been sent.'
					: 'Telegram is connected, but the welcome message could not be delivered.');
			}
		} catch (error) {
			const message = error.status === 409
				? 'This Telegram account or church account is already connected. Contact the church office if you need help.'
				: 'That connection link is invalid, expired, or already used. Create a new link from your church profile.';
			await context.reply(message);
		}
	});
	bot.catch((error) => {
		console.error('[telegram-bot] update failed:', error instanceof Error ? error.message : 'Unknown error.');
	});

	void bot.startPolling(undefined, {
		timeout: 30,
		retry: true,
		retryDelayMs: 1500,
		onError: (error) => console.error('[telegram-bot] polling temporarily failed:', error instanceof Error ? error.message : 'Unknown error.'),
	}).catch((error) => console.error('[telegram-bot] polling stopped:', error.message));
	console.info('[telegram-bot] secure account linking is listening.');
	return bot;
}

export async function stopTelegramBot() {
	if (!bot) return;
	bot.stop();
	bot = null;
}
