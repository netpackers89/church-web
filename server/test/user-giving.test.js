import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/config/db.js';
import { submitMyGiving } from '../src/controllers/userController.js';

const paymentMethods = [{
	id: 'cbe-main',
	name: 'Commercial Bank of Ethiopia',
	type: 'BANK',
	accountHolder: 'Church',
	accountNumber: '1000000000000',
	currency: 'ETB',
}];

function createResponse() {
	return {
		statusCode: 200,
		body: null,
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

function givingRequest(overrides = {}) {
	return {
		user: { id: 7 },
		body: {
			paymentMethodId: 'cbe-main',
			categoryCode: 'OTHER',
			otherPurpose: 'Emergency assistance',
			amount: '125.50',
			paymentReference: 'CBE-FT-123',
			transferDate: '2025-01-15',
			payerMode: 'OTHER',
			recipientName: 'Alem Desta',
			recipientPhone: '+251911223344',
			recipientMemberId: '42',
			accuracyConfirmed: true,
			...overrides,
		},
	};
}

test('giving submission stores a custom purpose and separate recipient identity', async () => {
	const originalQuery = pool.query;
	let insertValues;
	pool.query = async (query, values = []) => {
		if (query.includes('FROM system_settings')) {
			return { rows: [{ key: 'paymentMethods', value: paymentMethods }] };
		}
		if (query.includes('WHERE category_code=$1')) return { rowCount: 1, rows: [{ id: 11 }] };
		if (query.includes('FROM donation_categories WHERE id=$1')) return { rowCount: 1, rows: [{ id: 11 }] };
		if (query.includes('SELECT id FROM users WHERE id=$1')) return { rowCount: 1, rows: [{ id: 42 }] };
		if (query.includes('INSERT INTO donations')) {
			insertValues = values;
			return { rows: [{ id: 101, status: 'PENDING' }] };
		}
		throw new Error(`Unexpected giving query: ${query}`);
	};

	try {
		const response = createResponse();
		await submitMyGiving(givingRequest(), response);
		assert.equal(response.statusCode, 201);
		assert.equal(insertValues[12], 'Emergency assistance');
		assert.equal(insertValues[13], 'OTHER');
		assert.equal(insertValues[14], 'Alem Desta');
		assert.equal(insertValues[15], '+251911223344');
		assert.equal(insertValues[16], 42);
		assert.equal(response.body.data.status, 'PENDING');
	} finally {
		pool.query = originalQuery;
	}
});

test('fundraising contributions validate and retain the campaign payment account', async () => {
	const originalQuery = pool.query;
	let insertValues;
	let settingsRequested = false;
	pool.query = async (query, values = []) => {
		if (query.includes('FROM system_settings')) {
			settingsRequested = true;
			return { rows: [] };
		}
		if (query.includes('FROM fundraising_campaigns WHERE id = $1')) {
			return { rowCount: 1, rows: [{ id: 22, category_id: null }] };
		}
		if (query.includes('FROM campaign_payment_accounts')) {
			assert.deepEqual(values, ['5', 22]);
			return { rowCount: 1, rows: [{ id: '5', name: 'Building fund bank', currency: 'ETB' }] };
		}
		if (query.includes('INSERT INTO donations')) {
			insertValues = values;
			return { rows: [{ id: 102, status: 'PENDING' }] };
		}
		throw new Error(`Unexpected giving query: ${query}`);
	};

	try {
		const response = createResponse();
		await submitMyGiving(givingRequest({
			categoryCode: null,
			otherPurpose: '',
			campaignId: '22',
			campaignPaymentAccountId: '5',
			payerMode: 'SELF',
			recipientName: '',
			recipientPhone: '',
			recipientMemberId: null,
		}), response);
		assert.equal(response.statusCode, 201);
		assert.equal(settingsRequested, false);
		assert.equal(insertValues[7], 'campaign-5');
		assert.equal(insertValues[8], 'Building fund bank');
		assert.equal(insertValues[17], '5');
	} finally {
		pool.query = originalQuery;
	}
});

test('OTHER giving category requires a specified purpose', async () => {
	const originalQuery = pool.query;
	pool.query = async (query) => {
		if (query.includes('FROM system_settings')) {
			return { rows: [{ key: 'paymentMethods', value: paymentMethods }] };
		}
		if (query.includes('WHERE category_code=$1')) return { rowCount: 1, rows: [{ id: 11 }] };
		throw new Error(`Unexpected giving query: ${query}`);
	};

	try {
		const response = createResponse();
		await submitMyGiving(givingRequest({ otherPurpose: '' }), response);
		assert.equal(response.statusCode, 400);
		assert.match(response.body.error, /purpose/i);
	} finally {
		pool.query = originalQuery;
	}
});

test('giving submission rejects impossible payment dates', async () => {
	const originalQuery = pool.query;
	pool.query = async (query) => {
		if (query.includes('FROM system_settings')) {
			return { rows: [{ key: 'paymentMethods', value: paymentMethods }] };
		}
		throw new Error(`Unexpected giving query: ${query}`);
	};

	try {
		const response = createResponse();
		await submitMyGiving(givingRequest({ transferDate: '2025-02-31' }), response);
		assert.equal(response.statusCode, 400);
		assert.match(response.body.error, /payment date/i);
	} finally {
		pool.query = originalQuery;
	}
});
