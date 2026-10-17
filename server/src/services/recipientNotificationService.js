import { sendEmailNotification } from './emailService.js';
import { sendTelegramNotification } from './telegramService.js';
import { createWelcomeEmail } from './welcomeEmailTemplate.js';
import { renderEmailHtml } from './notificationStudioService.js';

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
	})[character]);
}

function welcomeMessage(name) {
	return createWelcomeEmail(name).text;
}

async function attemptDelivery(channel, recipient, message, subject, options = {}) {
	try {
		const html = typeof options === 'string' ? options : options.html;
		const details = channel === 'email'
			? await sendEmailNotification({ to: recipient.email, subject, text: message, html })
			: await sendTelegramNotification({
				chatId: recipient.telegramChatId,
				text: options.bannerUrl ? `<b>${escapeHtml(subject)}</b>\n\n${escapeHtml(message)}` : message,
				photoUrl: options.bannerUrl,
				buttons: options.actionUrl ? [{ text: options.buttonLabel || 'View details', url: options.actionUrl }] : [],
			});
		return { channel, status: 'delivered', details };
	} catch (error) {
		const reason = error instanceof Error ? error.message : 'Unknown delivery error.';
		return { channel, status: 'failed', error: reason };
	}
}

export function sendWelcomeMessage(recipient) {
	const deliveries = [];
	if (recipient.email) {
		const welcomeEmail = createWelcomeEmail(recipient.name);
		deliveries.push(attemptDelivery('email', recipient, welcomeEmail.text, welcomeEmail.subject, welcomeEmail.html));
	}
	if (recipient.telegramChatId) {
		deliveries.push(attemptDelivery('telegram', recipient, welcomeMessage(recipient.name)));
	}
	return Promise.all(deliveries);
}

export function sendMessageToRecipient(recipient, message, subject, channels, options = {}) {
	const selectedChannels = channels ?? ['email', 'telegram'];
	const deliveries = [];
	const personalizedMessage = message.replaceAll('{{name}}', recipient.name);
	const html = renderEmailHtml({
		greeting: `Hello ${recipient.name}`,
		subject,
		body: personalizedMessage,
		bannerUrl: options.bannerUrl,
		ctaUrl: options.actionUrl,
		ctaLabel: options.buttonLabel,
	});
	if (selectedChannels.includes('email')) {
		deliveries.push(recipient.email
			? attemptDelivery('email', recipient, personalizedMessage, subject, { html })
			: Promise.resolve({ channel: 'email', status: 'skipped', reason: 'Recipient has no email address.' }));
	}
	if (selectedChannels.includes('telegram')) {
		deliveries.push(recipient.telegramChatId
			? attemptDelivery('telegram', recipient, personalizedMessage, subject, options)
			: Promise.resolve({ channel: 'telegram', status: 'skipped', reason: 'Recipient has no Telegram chat ID.' }));
	}
	return Promise.all(deliveries);
}