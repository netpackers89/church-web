import test from 'node:test';
import assert from 'node:assert/strict';
import {
	telegramLanguageKeyboard,
	telegramLocale,
	telegramText,
} from '../src/telegram/templates/localization.js';
import {
	formatCampaigns,
	formatPaymentMethods,
	formatPrograms,
} from '../src/telegram/bot.js';

test('language labels and localized user-facing content exist for all supported languages', () => {
	for (const language of ['en', 'am', 'om']) {
		assert.ok(telegramText(language, 'menuPrograms'));
		assert.ok(telegramText(language, 'error'));
		assert.ok(telegramText(language, 'receiptsTitle'));
		assert.ok(telegramText(language, 'changeLanguage'));
		assert.ok(telegramText(language, 'groupFollowWelcome', { group: 'Youth' }).includes('Youth'));
	}
	assert.equal(telegramLocale('am'), 'am-ET');
	assert.equal(telegramLocale('om'), 'om-ET');
	assert.equal(telegramText('unknown', 'menuPrograms'), telegramText('en', 'menuPrograms'));
	assert.equal(telegramText('am', 'missingKey'), 'missingKey');
});

test('language selection offers the supported locale callback values', () => {
	assert.deepEqual(
		telegramLanguageKeyboard().inline_keyboard.flat().map(({ callback_data }) => callback_data),
		['language:en', 'language:am', 'language:om'],
	);
});

test('financial review notifications are localized without changing receipt identifiers', () => {
	const approved = telegramText('om', 'contributionApproved', {
		currency: 'ETB',
		amount: '250.00',
		church: 'Church Name',
		receipt: 'RCPT-20261020-AB12CD',
	});
	const rejected = telegramText('am', 'contributionRejected', {
		church: 'Church Name',
		reason: 'Missing transaction reference',
	});

	assert.match(approved, /Church Name/);
	assert.match(approved, /ETB 250\.00/);
	assert.match(approved, /RCPT-20261020-AB12CD/);
	assert.match(rejected, /Church Name/);
	assert.match(rejected, /Missing transaction reference/);
});

test('database-backed program, giving, campaign and receipt content uses localized labels and preserves record values', () => {
	const event = [{ title: 'Sunday Worship', startAt: '2026-11-01T06:00:00.000Z', location: 'Main Sanctuary' }];
	const payment = [{ name: 'CBE', type: 'BANK', accountNumber: '00123456' }];
	const campaign = [{ title: 'Youth Hall', goalAmount: null, raisedAmount: '2500.00', currency: 'ETB' }];

	assert.match(formatPrograms(event, 'am'), /የሚቀጥሉ/);
	assert.match(formatPrograms(event, 'om'), /Dhufan/);
	assert.match(formatPaymentMethods(payment, 'am'), /ይፋዊ የመዋጮ/);
	assert.match(formatPaymentMethods(payment, 'om'), /Herrega Kennaa Sirrii/);
	assert.match(formatCampaigns(campaign, 'am'), /የተሰበሰበ/);
	assert.match(formatCampaigns(campaign, 'om'), /Youth Hall/);
});
