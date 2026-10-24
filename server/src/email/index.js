import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { config } from '../config/env.js';
import { getEmailTransporter } from './transporter.js';

const RETRYABLE_CODES = new Set([
	'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH',
	'ENETUNREACH', 'ETIMEDOUT', 'ESOCKET', 'EAI_AGAIN',
]);

function retryable(error) {
	return RETRYABLE_CODES.has(error.code)
		|| [421, 450, 451, 452].includes(Number(error.responseCode));
}

function messageIdFor(key) {
	const hash = createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
	return `<${hash}@church-notifications>`;
}

export async function sendEmailNotification({ to, subject, text, html, attachments, idempotencyKey }) {
	const transporter = getEmailTransporter();
	const message = {
		from: config.smtp.from,
		to,
		subject,
		text,
		...(html ? { html } : {}),
		...(Array.isArray(attachments) && attachments.length ? { attachments } : {}),
		...(idempotencyKey ? { messageId: messageIdFor(idempotencyKey) } : {}),
	};
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const sent = await transporter.sendMail(message);
			return { messageId: sent.messageId, recipient: to };
		} catch (error) {
			if (attempt === 3 || !retryable(error)) {
				console.error('[email] Delivery failed:', error.code || error.responseCode || error.message);
				throw error;
			}
			const wait = 500 * (2 ** (attempt - 1));
			console.warn(`[email] Transient delivery error; retrying in ${wait}ms (attempt ${attempt + 1}/3).`);
			await delay(wait);
		}
	}
	throw new Error('Email delivery failed without a provider response.');
}

export async function sendStartupConfirmation() {
	if (!config.smtp.to) {
		throw new Error('Email provider is not configured: EMAIL_TO.');
	}
	const transporter = getEmailTransporter();
	await transporter.verify();
	return sendEmailNotification({
		to: config.smtp.to,
		subject: 'Church notifications: email provider is ready',
		text: `Email notifications are working. The server started successfully at ${new Date().toISOString()}.`,
	});
}

export {
	createNewBelieverWelcomeEmail,
	createNewChristianWelcomeEmail,
	createWelcomeEmail,
} from './templates/welcome.js';
