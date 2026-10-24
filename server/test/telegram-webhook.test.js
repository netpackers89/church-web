import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import { telegramWebhook } from '../src/controllers/telegramController.js';
import { startTelegramBot, stopTelegramBot } from '../src/telegram/bot.js';

function responseRecorder() {
	return {
		statusCode: 200,
		body: undefined,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(body) {
			this.body = body;
			return this;
		},
	};
}

test('Telegram webhook retries failed updates and ignores processed duplicates', async (context) => {
	const originalQuery = pool.query;
	const originalToken = config.telegram.token;
	const originalWebhookUrl = config.telegramWebhookUrl;
	const originalWebhookSecret = config.telegramWebhookSecret;
	const sentMessages = [];
	let status = null;
	let messageInsertAttempts = 0;

	context.after(async () => {
		await stopTelegramBot();
		pool.query = originalQuery;
		config.telegram.token = originalToken;
		config.telegramWebhookUrl = originalWebhookUrl;
		config.telegramWebhookSecret = originalWebhookSecret;
	});

	config.telegram.token = '123456:test-token';
	config.telegramWebhookUrl = 'https://example.test/telegram-webhook';
	config.telegramWebhookSecret = 'test-secret';
	pool.query = async (query) => {
		if (query.includes('INSERT INTO telegram_updates')) {
			if (status === 'PROCESSED') return { rowCount: 0, rows: [] };
			assert.ok(status === null || status === 'FAILED');
			status = 'PROCESSING';
			return { rowCount: 1, rows: [{ id: '51' }] };
		}
		if (query.includes("SET processing_status='FAILED'")) {
			status = 'FAILED';
			return { rowCount: 1, rows: [] };
		}
		if (query.includes("SET processing_status='PROCESSED'")) {
			status = 'PROCESSED';
			return { rowCount: 1, rows: [] };
		}
		if (query.includes('INSERT INTO telegram_accounts') && query.includes('language_code AS language')) {
			throw Object.assign(new Error('column "language_code" does not exist'), { code: '42703' });
		}
		if (query.includes('INSERT INTO telegram_accounts')) {
			return { rowCount: 1, rows: [{ id: '71' }] };
		}
		if (query.includes('INSERT INTO telegram_messages')) {
			messageInsertAttempts += 1;
			if (messageInsertAttempts === 1) throw new Error('Temporary message storage failure');
			return { rowCount: 1, rows: [] };
		}
		if (query.includes('SELECT u.id, u.name, ta.username')) return { rowCount: 0, rows: [] };
		throw new Error(`Unexpected SQL in Telegram webhook test: ${query}`);
	};

	const bot = startTelegramBot();
	bot.api.sendPhoto = async (parameters) => {
		sentMessages.push(parameters);
		return { message_id: sentMessages.length };
	};
	bot.api.sendMessage = async (parameters) => {
		sentMessages.push(parameters);
		return { message_id: sentMessages.length };
	};

	const request = {
		body: {
			update_id: 1234,
			message: {
				message_id: 12,
				date: Math.floor(Date.now() / 1000),
				chat: { id: 987, type: 'private' },
				from: { id: 987, first_name: 'Test' },
				text: '/start',
			},
		},
		get: () => 'test-secret',
	};

	const failed = responseRecorder();
	await telegramWebhook(request, failed);
	assert.equal(failed.statusCode, 500);
	assert.equal(status, 'FAILED');

	const retried = responseRecorder();
	await telegramWebhook(request, retried);
	assert.equal(retried.statusCode, 200);
	assert.deepEqual(retried.body, { ok: true });
	assert.equal(status, 'PROCESSED');
	assert.ok(sentMessages.length > 0);
	const deliveryCount = sentMessages.length;

	const duplicate = responseRecorder();
	await telegramWebhook(request, duplicate);
	assert.equal(duplicate.statusCode, 200);
	assert.deepEqual(duplicate.body, { ok: true, duplicate: true });
	assert.equal(sentMessages.length, deliveryCount);
});
