import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { updateCampaign } from '../src/controllers/campaignController.js';

function responseMock() {
	return {
		statusCode: 200,
		body: null,
		status(code) { this.statusCode = code; return this; },
		json(body) { this.body = body; return this; },
	};
}

test('deactivates removed campaign accounts without deleting their historical rows', async (context) => {
	const originalConnect = pool.connect;
	const originalQuery = pool.query;
	const statements = [];
	pool.connect = async () => ({
		async query(sql) {
			statements.push(sql);
			if (sql.includes('SELECT * FROM fundraising_campaigns')) {
				return {
					rowCount: 1,
					rows: [{
						id: 12, title: 'Building fund', description: null, goal_amount: 1000,
						currency: 'ETB', starts_at: null, ends_at: null, status: 'ACTIVE',
						category_id: null, banner_url: null, cta_url: null,
					}],
				};
			}
			if (sql.includes('UPDATE fundraising_campaigns')) {
				return { rowCount: 1, rows: [{ id: 12, title: 'Building fund', status: 'ACTIVE' }] };
			}
			if (sql.includes('SELECT id FROM campaign_payment_accounts')) {
				return { rowCount: 1, rows: [{ id: '3' }] };
			}
			return { rowCount: 1, rows: [] };
		},
		release() {},
	});
	pool.query = async () => ({ rowCount: 1, rows: [] });
	context.after(() => {
		pool.connect = originalConnect;
		pool.query = originalQuery;
	});
	const response = responseMock();

	await updateCampaign({
		params: { id: '12' },
		body: { paymentAccounts: [] },
		user: { id: 1 },
	}, response);

	assert.equal(response.statusCode, 200);
	assert.ok(statements.includes('COMMIT'));
	assert.ok(statements.some((sql) => sql.includes('UPDATE campaign_payment_accounts SET is_active=FALSE')));
	assert.ok(!statements.some((sql) => sql.includes('DELETE FROM campaign_payment_accounts')));
});

test('rejects payment accounts belonging to another campaign and rolls back', async (context) => {
	const originalConnect = pool.connect;
	const originalQuery = pool.query;
	const statements = [];
	pool.connect = async () => ({
		async query(sql) {
			statements.push(sql);
			if (sql.includes('SELECT * FROM fundraising_campaigns')) {
				return {
					rowCount: 1,
					rows: [{
						id: 12, title: 'Building fund', description: null, goal_amount: 1000,
						currency: 'ETB', starts_at: null, ends_at: null, status: 'ACTIVE',
						category_id: null, banner_url: null, cta_url: null,
					}],
				};
			}
			if (sql.includes('UPDATE fundraising_campaigns')) {
				return { rowCount: 1, rows: [{ id: 12, title: 'Building fund', status: 'ACTIVE' }] };
			}
			if (sql.includes('SELECT id FROM campaign_payment_accounts')) {
				return { rowCount: 0, rows: [] };
			}
			return { rowCount: 1, rows: [] };
		},
		release() {},
	});
	pool.query = async () => ({ rowCount: 1, rows: [] });
	context.after(() => {
		pool.connect = originalConnect;
		pool.query = originalQuery;
	});
	const response = responseMock();

	await updateCampaign({
		params: { id: '12' },
		body: {
			paymentAccounts: [{
				id: '999', name: 'Church account', type: 'BANK', accountNumber: '123456',
				currency: 'ETB', isActive: true,
			}],
		},
		user: { id: 1 },
	}, response);

	assert.equal(response.statusCode, 400);
	assert.match(response.body.error, /does not belong to this campaign/);
	assert.ok(statements.includes('ROLLBACK'));
	assert.ok(!statements.includes('COMMIT'));
});
