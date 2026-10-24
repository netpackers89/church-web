import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporter;

export function getEmailTransporter() {
	if (transporter) return transporter;
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

	transporter = nodemailer.createTransport({
		host,
		port,
		secure: config.smtp.secure,
		auth: { user, pass: password },
		family: 4,
		connectionTimeout: 10000,
		greetingTimeout: 10000,
		socketTimeout: 15000,
	});
	return transporter;
}

export async function closeEmailTransporter() {
	if (!transporter) return;
	const current = transporter;
	transporter = undefined;
	current.close();
}
