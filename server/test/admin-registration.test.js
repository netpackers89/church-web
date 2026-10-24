import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { activateAccount, registerStaff } from '../src/controllers/adminRegistrationController.js';

function responseMock() {
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

function mockConnection(context, { failOn } = {}) {
	const originalConnect = pool.connect;
	const statements = [];
	let released = false;
	pool.connect = async () => ({
		async query(sql, values = []) {
			statements.push({ sql, values });
			if (failOn && sql.includes(failOn)) throw new Error('simulated database write failure');
			if (sql.includes('SELECT id FROM roles')) return { rowCount: 1, rows: [{ id: 3 }] };
			if (sql.includes('SELECT id FROM users')) return { rowCount: 0, rows: [] };
			if (sql.includes('INSERT INTO users')) {
				return {
					rowCount: 1,
					rows: [{
						id: 34,
						name: 'Staff',
						email: 'staff@example.org',
						accountStatus: values[9],
					}],
				};
			}
			if (sql.includes('UPDATE account_activation_tokens')) {
				return { rowCount: 1, rows: [{ user_id: 34 }] };
			}
			return { rowCount: 1, rows: [] };
		},
		release() {
			released = true;
		},
	});
	context.after(() => {
		pool.connect = originalConnect;
	});
	return {
		statements,
		get released() {
			return released;
		},
	};
}

test('registers a pending staff account with activation token and audit atomically', async (context) => {
	const database = mockConnection(context);
	const response = responseMock();

	await registerStaff({
		body: {
			fullName: 'Staff',
			email: 'staff@example.org',
			role: 'STAFF',
		},
		user: { id: 7, roles: ['SYSTEM_OWNER'], permissions: ['roles.manage'] },
		ip: '127.0.0.1',
	}, response);

	assert.equal(response.statusCode, 201);
	assert.equal(response.body.data.user.id, 34);
	assert.equal(response.body.data.user.accountStatus, 'PENDING_ACTIVATION');
	assert.equal(typeof response.body.data.activationToken, 'string');
	const tokenInsert = database.statements.find(({ sql }) => sql.includes('INSERT INTO account_activation_tokens'));
	assert.equal(tokenInsert.values[1], createHash('sha256').update(response.body.data.activationToken).digest('hex'));
	assert.ok(database.statements.some(({ sql }) => sql.includes('INSERT INTO audit_logs')));
	assert.equal(database.statements.at(-1).sql, 'COMMIT');
	assert.equal(database.released, true);
});

test('an administrator with role-management permission can register an ADMIN staff account', async (context) => {
	const database = mockConnection(context);
	const response = responseMock();

	await registerStaff({
		body: { fullName: 'Staff Administrator', email: 'staff-admin@example.org', role: 'ADMIN' },
		user: { id: 7, role: 'ADMIN', roles: ['ADMIN'], permissions: ['roles.manage'] },
	}, response);

	assert.equal(response.statusCode, 201);
	const userInsert = database.statements.find(({ sql }) => sql.includes('INSERT INTO users'));
	assert.equal(userInsert.values[8], 'ADMIN');
});

test('rolls back staff creation when its audit event cannot be written', async (context) => {
	const database = mockConnection(context, { failOn: 'INSERT INTO audit_logs' });
	const originalConsoleError = console.error;
	console.error = () => {};
	context.after(() => {
		console.error = originalConsoleError;
	});
	const response = responseMock();

	await registerStaff({
		body: { fullName: 'Staff', email: 'staff@example.org', role: 'STAFF' },
		user: { id: 7, roles: ['SYSTEM_OWNER'], permissions: ['roles.manage'] },
	}, response);

	assert.equal(response.statusCode, 500);
	assert.ok(database.statements.some(({ sql }) => sql === 'ROLLBACK'));
	assert.ok(!database.statements.some(({ sql }) => sql === 'COMMIT'));
	assert.equal(database.released, true);
});

test('activates the account, consumes the token, and audits in one transaction', async (context) => {
	const database = mockConnection(context);
	const response = responseMock();

	await activateAccount({
		body: { token: 'one-time-token', password: 'Long enough password 123' },
		user: { id: 7 },
		ip: '127.0.0.1',
	}, response);

	assert.equal(response.statusCode, 200);
	assert.ok(database.statements.some(({ sql }) => sql.includes('UPDATE account_activation_tokens')));
	assert.ok(database.statements.some(({ sql, values }) => sql.includes('UPDATE users') && values[1] === 'ACTIVE'));
	assert.ok(database.statements.some(({ sql }) => sql.includes('INSERT INTO audit_logs')));
	assert.equal(database.statements.at(-1).sql, 'COMMIT');
	assert.equal(database.released, true);
});
