import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { config } from '../src/config/env.js';
import { closeEmailTransporter, getEmailTransporter } from '../src/email/transporter.js';
import { sendTelegramDocument } from '../src/telegram/services/messaging.js';
import { createContributionReceiptPdf } from '../src/services/receiptPdfService.js';

test('email transport is initialized once and can be closed cleanly', async (context) => {
	const originalSmtp = { ...config.smtp };
	context.after(async () => {
		await closeEmailTransporter();
		Object.assign(config.smtp, originalSmtp);
	});

	Object.assign(config.smtp, {
		host: '127.0.0.1',
		port: 2525,
		user: 'test-user',
		password: 'test-password',
		from: 'Church <noreply@example.test>',
		secure: false,
	});

	const first = getEmailTransporter();
	assert.equal(getEmailTransporter(), first);
});

test('Telegram document delivery uses the centralized multipart sender', async (context) => {
	const originalPost = axios.post;
	const originalToken = config.telegram.token;
	let request;
	context.after(() => {
		axios.post = originalPost;
		config.telegram.token = originalToken;
	});

	config.telegram.token = '123456:test-token';
	axios.post = async (url, body, options) => {
		request = { url, body, options };
		return { data: { ok: true, result: { message_id: 41 } } };
	};

	const result = await sendTelegramDocument({
		chatId: '12345',
		document: Buffer.from('%PDF-test'),
		filename: 'receipt-41.pdf',
		caption: 'Approved contribution receipt',
	});

	assert.equal(result.messageId, 41);
	assert.equal(request.url, 'https://api.telegram.org/bot123456:test-token/sendDocument');
	assert.equal(request.options.timeout, 20000);
	assert.equal(request.body.get('chat_id'), '12345');
	assert.equal(request.body.get('document').name, 'receipt-41.pdf');
	assert.equal(request.body.get('caption'), 'Approved contribution receipt');
});

test('contribution receipt generator returns a PDF buffer', async () => {
	const pdf = await createContributionReceiptPdf({
		receiptNumber: 'RCPT-41',
		contributorName: 'Test Contributor',
		amount: '25.00',
		currency: 'ETB',
		receivedAt: '2026-01-10T10:00:00Z',
	});

	assert.ok(Buffer.isBuffer(pdf));
	assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});
