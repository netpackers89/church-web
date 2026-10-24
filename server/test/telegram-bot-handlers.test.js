import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config/env.js';
import { pool } from '../src/config/db.js';
import {
	handleTelegramUpdate,
	startTelegramBot,
	stopTelegramBot,
} from '../src/telegram/bot.js';
import { telegramText } from '../src/telegram/templates/localization.js';

test('Telegram bot uses English without migration and keeps language switching available', async (context) => {
	const oldToken = config.telegram.token;
	const oldWebhookUrl = config.telegramWebhookUrl;
	const oldWebsiteUrl = config.branding.websiteUrl;
	const originalQuery = pool.query;
	const sentMessages = [];
	let menuItems = [];
	let autoReplyRules = [];
	let autoReplyReads = 0;

	context.after(async () => {
		await stopTelegramBot();
		config.telegram.token = oldToken;
		config.telegramWebhookUrl = oldWebhookUrl;
		config.branding.websiteUrl = oldWebsiteUrl;
		pool.query = originalQuery;
	});

	config.telegram.token = '123456:test-token';
	config.telegramWebhookUrl = 'https://example.test/telegram-webhook';
	config.branding.websiteUrl = 'http://localhost:5173';
	pool.query = async (query) => {
		if (query.includes('language_code')) {
			throw Object.assign(new Error('column "language_code" does not exist'), { code: '42703' });
		}
		if (query.includes('FROM telegram_menu_items')) return { rows: menuItems, rowCount: menuItems.length };
		if (query.includes('FROM telegram_auto_reply_rules')) {
			autoReplyReads += 1;
			return { rows: autoReplyRules, rowCount: autoReplyRules.length };
		}
		return { rows: [] };
	};

	const mockTelegramApi = (instance) => {
		instance.api.sendPhoto = async (parameters) => {
			sentMessages.push({ method: 'sendPhoto', parameters });
			return { message_id: sentMessages.length };
		};
		instance.api.sendMessage = async (parameters) => {
			sentMessages.push({ method: 'sendMessage', parameters });
			return { message_id: sentMessages.length };
		};
		instance.api.answerCallbackQuery = async () => ({});
	};
	const bot = startTelegramBot();
	assert.equal(startTelegramBot(), bot);
	mockTelegramApi(bot);

	const sender = { id: 123, first_name: 'Member' };
	const message = (updateId, text) => ({
		update_id: updateId,
		message: {
			message_id: updateId,
			date: Math.floor(Date.now() / 1000),
			chat: { id: 123, type: 'private' },
			from: sender,
			text,
		},
	});
	const callback = (updateId, data) => ({
		update_id: updateId,
		callback_query: {
			id: String(updateId),
			from: sender,
			message: {
				message_id: updateId,
				chat: { id: 123, type: 'private' },
			},
			data,
		},
	});

	await handleTelegramUpdate(message(1, '/start'));
	const englishMenu = sentMessages.find(({ parameters }) => parameters.reply_markup?.keyboard);
	assert.ok(englishMenu);
	assert.equal(englishMenu.parameters.reply_markup.is_persistent, true);
	assert.equal(englishMenu.parameters.reply_markup.keyboard.at(-1)[0].text, telegramText('en', 'changeLanguage'));
	const englishKeyboardLabels = englishMenu.parameters.reply_markup.keyboard.flat().map(({ text }) => text);
	assert.ok(!englishKeyboardLabels.includes(telegramText('en', 'menuSignup')));
	assert.ok(!englishKeyboardLabels.includes(telegramText('en', 'menuConnect')));
	const welcome = sentMessages.find(({ method }) => method === 'sendPhoto');
	assert.ok(welcome);
	const welcomeMarkup = JSON.stringify(welcome.parameters.reply_markup ?? '');
	assert.ok(!welcomeMarkup.includes('/register'));
	assert.ok(!welcomeMarkup.includes('/me/account'));

	await handleTelegramUpdate(message(2, 'Connect My Account'));
	const connectInstructions = sentMessages.find(({ parameters }) => parameters.text === telegramText('en', 'connectInstructions'));
	assert.ok(connectInstructions);
	assert.equal(connectInstructions.parameters.reply_markup, undefined);

	await handleTelegramUpdate(callback(3, 'language:change'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.reply_markup?.inline_keyboard?.some((row) => row.some((button) => button.callback_data === 'language:en'))));

	await handleTelegramUpdate(callback(4, 'language:am'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.reply_markup?.keyboard?.[0]?.[0]?.text === telegramText('am', 'menuPrograms')));
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === telegramText('am', 'languageChanged')));

	await handleTelegramUpdate(message(5, 'Connect My Account'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === telegramText('am', 'connectInstructions')));

	await handleTelegramUpdate(message(6, '/signup'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === telegramText('am', 'signupInstructions')));

	await stopTelegramBot();
	mockTelegramApi(startTelegramBot());
	await handleTelegramUpdate(message(7, '/menu'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.reply_markup?.keyboard?.[0]?.[0]?.text === telegramText('am', 'menuPrograms')));

	menuItems = [{
		id: '83',
		key: 'service_times',
		labels: { en: 'Service times', am: 'የአገልግሎት ሰዓት', om: 'Yeroo tajaajilaa' },
		responses: { en: 'Sunday at 9 AM', am: 'እሁድ 3 ሰዓት', om: 'Dilbata sa’aatii 9' },
		actionType: 'TEXT',
		visibility: 'EVERYONE',
	}];
	await handleTelegramUpdate(message(8, '/menu'));
	const configuredMenuMessage = sentMessages.find(({ parameters }) => parameters.reply_markup?.keyboard?.some((row) => row.some((button) => button.text === 'የአገልግሎት ሰዓት')));
	assert.ok(configuredMenuMessage, 'active database menu item should appear in the configured persistent keyboard');
	await handleTelegramUpdate(message(81, 'የአገልግሎት ሰዓት'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === 'እሁድ 3 ሰዓት'), 'edited/custom keyboard labels should execute their configured action');

	autoReplyRules = [{
		id: '5',
		name: 'Service schedule',
		keywords: ['service time'],
		matchType: 'CONTAINS',
		responses: { en: 'Sunday at 9 AM', am: 'እሁድ 3 ሰዓት', om: 'Dilbata sa’aatii 9' },
		priority: 1,
	}];
	await handleTelegramUpdate(message(9, 'What is the service time?'));
	assert.ok(autoReplyReads > 0, 'private messages should evaluate active auto-reply rules');
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === 'እሁድ 3 ሰዓት'), 'active rule should respond in the selected language');

	await handleTelegramUpdate(callback(10, 'config-menu:83'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === 'እሁድ 3 ሰዓት'), 'configured text menu action should send its localized response');

	await handleTelegramUpdate(message(11, '/contact'));
	const categoryPrompt = sentMessages.find(({ parameters }) => parameters.reply_markup?.inline_keyboard?.some((row) => row.some((button) => button.callback_data === 'contact:category:PRAYER_REQUEST')));
	assert.ok(categoryPrompt, 'contact command should display the supported category choices');
	await handleTelegramUpdate(callback(12, 'contact:category:SUGGESTION'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === telegramText('am', 'contactWriteMessage')));
	await handleTelegramUpdate(callback(13, 'contact:cancel'));
	assert.ok(sentMessages.some(({ parameters }) => parameters.text === telegramText('am', 'contactCancelled')));
});
