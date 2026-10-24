import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { getAdminCampaign } from '../src/controllers/campaignController.js';

function responseMock() {
	return {
		statusCode: 200,
		body: null,
		status(code) { this.statusCode = code; return this; },
		json(body) { this.body = body; return this; },
	};
}

test('campaign detail includes its accounts, verified total, and contribution statuses', async (context) => {
	const originalQuery = pool.query;
	const statements = [];
	pool.query = async (sql, values) => {
		statements.push({ sql, values });
		if (sql.includes('FROM fundraising_campaigns c')) {
			return {
				rowCount: 1,
				rows: [{
					id: '12',
					title: 'Building fund',
					status: 'ACTIVE',
					currency: 'ETB',
					raisedAmount: '125.00',
					paymentAccounts: [{ id: '2', name: 'Church account', isActive: true }],
				}],
			};
		}
		if (sql.includes('FROM donations')) {
			return {
				rowCount: 2,
				rows: [
					{ id: '24', contributorName: 'A. Member', amount: '100.00', currency: 'ETB', status: 'APPROVED' },
					{ id: '23', contributorName: 'B. Member', amount: '25.00', currency: 'ETB', status: 'PENDING' },
				],
			};
		}
		throw new Error(`Unexpected SQL in campaign detail test: ${sql}`);
	};
	context.after(() => {
		pool.query = originalQuery;
	});

	const response = responseMock();
	await getAdminCampaign({ params: { id: '12' } }, response);

	assert.equal(response.statusCode, 200);
	assert.equal(response.body.data.raisedAmount, '125.00');
	assert.equal(response.body.data.paymentAccounts.length, 1);
	assert.deepEqual(response.body.data.contributions.map((row) => row.status), ['APPROVED', 'PENDING']);
	assert.match(statements[1].sql, /deleted_at IS NULL/);
	assert.match(statements[1].sql, /LIMIT 100/);
	assert.deepEqual(statements.map(({ values }) => values), [['12'], ['12']]);
});
