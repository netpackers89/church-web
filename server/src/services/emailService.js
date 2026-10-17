import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

function createTransporter() {
	const { host, port, user, password } = config.smtp;
	const missing = [
		['SMTP_HOST', host],
		['SMTP_USER', user],
		['SMTP_PASS', password],
		['EMAIL_FROM', config.smtp.from],
	].filter(([, value]) => !value).map(([name]) => name);

	if (missing.length) {
		throw new Error(`Email provider is not configured: ${missing.join(', ')}.`);
	}

	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('SMTP_PORT must be a valid TCP port number.');
	}

	return nodemailer.createTransport({
		host,
		port,
		secure: config.smtp.secure,
		auth: { user, pass: password },
		connectionTimeout: 10000,
		greetingTimeout: 10000,
		socketTimeout: 15000,
	});
}

export async function sendEmailNotification({ to, subject, text, html }) {
	const transporter = createTransporter();
	const sent = await transporter.sendMail({
		from: config.smtp.from,
		to,
		subject,
		text,
		...(html ? { html } : {}),
	});
	return { messageId: sent.messageId, recipient: to };
}

export async function sendStartupConfirmation() {
	if (!config.smtp.to) {
		throw new Error('Email provider is not configured: EMAIL_TO.');
	}
	const transporter = createTransporter();
	await transporter.verify();
	const sent = await transporter.sendMail({
		from: config.smtp.from,
		to: config.smtp.to,
		subject: 'Church notifications: email provider is ready',
		text: `Email notifications are working. The server started successfully at ${new Date().toISOString()}.`,
	});

	return { messageId: sent.messageId, recipient: config.smtp.to };
}
