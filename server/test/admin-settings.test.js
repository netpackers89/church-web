import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import { updateSettings } from '../src/controllers/adminController.js';

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

test('updates settings and writes the audit event in the same transaction', async (context) => {
	const originalConnect = pool.connect;
	const statements = [];
	const writes = [];
	const client = {
		async query(sql, values) {
			statements.push(sql);
			if (sql.includes('INSERT INTO system_settings')) writes.push({ sql, values });
			return { rowCount: 1, rows: [] };
		},
		release() {},
	};
	pool.connect = async () => client;
	context.after(() => {
		pool.connect = originalConnect;
	});

	const response = responseMock();
	await updateSettings({
		body: { churchName: 'Church' },
		user: { id: 17 },
		ip: '127.0.0.1',
	}, response);

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.body, { success: true, message: 'Settings updated.' });
	assert.equal(statements[0], 'BEGIN');
	assert.ok(statements.some((sql) => sql.includes('INSERT INTO system_settings')));
	assert.equal(writes.length, 1);
	assert.match(writes[0].sql, /INSERT INTO system_settings\(key,value\)/);
	assert.doesNotMatch(writes[0].sql, /updated_by|updated_at/);
	assert.deepEqual(writes[0].values, ['churchName', '"Church"']);
	assert.ok(statements.some((sql) => sql.includes('INSERT INTO audit_logs')));
	assert.equal(statements.at(-1), 'COMMIT');
});

test('returns a database error response when settings cannot acquire a connection', async (context) => {
	const originalConnect = pool.connect;
	pool.connect = async () => {
		throw Object.assign(new Error('Connection terminated due to connection timeout'), { code: 'ETIMEDOUT' });
	};
	context.after(() => {
		pool.connect = originalConnect;
	});

	const originalConsoleError = console.error;
	console.error = () => {};
	context.after(() => {
		console.error = originalConsoleError;
	});

	const response = responseMock();
	await updateSettings({
		body: { churchName: 'Church' },
		user: { id: 17 },
	}, response);

	assert.equal(response.statusCode, 503);
	assert.deepEqual(response.body, { error: 'The database is temporarily unavailable.' });
});

test('rolls back settings when the audit event cannot be written', async (context) => {
	const originalConnect = pool.connect;
	const statements = [];
	pool.connect = async () => ({
		async query(sql) {
			statements.push(sql);
			if (sql.includes('INSERT INTO audit_logs')) throw new Error('simulated audit failure');
			return { rowCount: 1, rows: [] };
		},
		release() {},
	});
	context.after(() => {
		pool.connect = originalConnect;
	});

	const originalConsoleError = console.error;
	console.error = () => {};
	context.after(() => {
		console.error = originalConsoleError;
	});

	const response = responseMock();
	await updateSettings({
		body: { churchName: 'Church' },
		user: { id: 17 },
	}, response);

	assert.equal(response.statusCode, 500);
	assert.ok(statements.includes('ROLLBACK'));
	assert.ok(!statements.includes('COMMIT'));
});
