import test from 'node:test';
import assert from 'node:assert/strict';
import {
	formatCampaigns,
	formatPaymentMethods,
	formatPrograms,
	formatReceipts,
} from '../src/telegram/bot.js';

test('Telegram program content escapes church data and formats the configured timezone', () => {
	const text = formatPrograms([{
		title: '<Sunday & Worship>',
		startAt: '2026-11-01T06:00:00.000Z',
		timezone: 'Africa/Addis_Ababa',
		location: 'Main <Sanctuary>',
	}]);

	assert.match(text, /&lt;Sunday &amp; Worship&gt;/);
	assert.match(text, /Main &lt;Sanctuary&gt;/);
	assert.doesNotMatch(text, /<Sunday/);
});

test('Telegram giving content uses only configured account information and escapes it', () => {
	const text = formatPaymentMethods([{
		name: 'CBE <Bank>',
		type: 'BANK',
		accountNumber: '00123456',
		accountHolder: 'Church & Ministry',
		branch: '',
		instructions: '',
	}]);

	assert.match(text, /CBE &lt;Bank&gt;/);
	assert.match(text, /<code>00123456<\/code>/);
	assert.match(text, /Church &amp; Ministry/);
	assert.doesNotMatch(text, /1000123456789/);
});

test('Telegram campaigns show current database totals without a hardcoded goal', () => {
	const text = formatCampaigns([{
		title: 'Youth hall',
		goalAmount: null,
		raisedAmount: '2500.50',
		currency: 'ETB',
		endsAt: null,
	}]);

	assert.match(text, /Youth hall/);
	assert.match(text, /2,500\.50 ETB/);
	assert.doesNotMatch(text, /500,000/);
});

test('Telegram receipt content is limited to approved receipt data and escapes references', () => {
	const text = formatReceipts([{
		amount: '100.00',
		currency: 'ETB',
		category: 'Tithe',
		paymentReference: '<ref&123>',
		verifiedAt: '2026-10-01T10:00:00.000Z',
	}]);

	assert.match(text, /<b>100\.00 ETB<\/b>/);
	assert.match(text, /&lt;ref&amp;123&gt;/);
	assert.doesNotMatch(text, /BANK-999777/);
});

test('Telegram programs and receipts have honest empty states', () => {
	assert.match(formatPrograms([]), /no upcoming public events/i);
	assert.match(formatReceipts([]), /No approved contributions/i);
});
