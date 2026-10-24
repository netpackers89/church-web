import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { getMyProfile } from '../src/controllers/userController.js';

test('profile requests succeed for staff accounts without a birth date', async (context) => {
	const originalQuery = pool.query;
	let query;
	pool.query = async (sql) => {
		query = sql;
		return {
			rowCount: 1,
			rows: [{
				id: 34,
				name: 'Staff Member',
				accountStatus: 'ACTIVE',
				birthDateEc: null,
				telegramChatId: null,
			}],
		};
	};
	context.after(() => { pool.query = originalQuery; });

	const response = {
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

	await getMyProfile({ user: { id: 34, roles: ['STAFF'], permissions: [] } }, response);

	assert.equal(response.statusCode, 200);
	assert.equal(response.body.data.age, null);
	assert.equal(response.body.data.telegramConnected, false);
	assert.match(query, /TO_CHAR\(birth_date_ec, 'YYYY-MM-DD'\) AS "birthDateEc"/);
});

test('profile queries return Ethiopian birth dates as ISO strings for age calculation', async (context) => {
	const originalQuery = pool.query;
	pool.query = async () => ({
		rowCount: 1,
		rows: [{
			id: 35,
			name: 'Member',
			accountStatus: 'ACTIVE',
			birthDateEc: '1997-01-05',
			telegramChatId: null,
		}],
	});
	context.after(() => { pool.query = originalQuery; });

	const response = {
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

	await getMyProfile({ user: { id: 35, roles: ['MEMBER'], permissions: [] } }, response);

	assert.equal(response.statusCode, 200);
	assert.equal(response.body.data.birthDateEc, '1997-01-05');
	assert.equal(typeof response.body.data.age, 'number');
});
