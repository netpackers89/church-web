import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../src/config/db.js';
import {
	createAnnouncement,
	listAnnouncements,
	updateAnnouncement,
} from '../src/controllers/adminController.js';

function responseMock() {
	return {
		statusCode: 200,
		body: null,
		status(code) { this.statusCode = code; return this; },
		json(body) { this.body = body; return this; },
	};
}

test('lists announcements with qualified soft-delete and group filters', async (context) => {
	const originalQuery = pool.query;
	let query;
	pool.query = async (sql, values) => {
		query = { sql, values };
		return { rowCount: 0, rows: [] };
	};
	context.after(() => {
		pool.query = originalQuery;
	});

	const response = responseMock();
	await listAnnouncements({ query: { departmentId: '7' } }, response);

	assert.equal(response.statusCode, 200);
	assert.deepEqual(response.body.data, []);
	assert.match(query.sql, /WHERE a\.deleted_at IS NULL/);
	assert.match(query.sql, /a\.department_id = \$3/);
	assert.deepEqual(query.values, [24, 0, 7]);
});

test('creates announcements and writes an audit record', async (context) => {
	const originalQuery = pool.query;
	const statements = [];
	pool.query = async (sql, values) => {
		statements.push({ sql, values });
		if (sql.includes('INSERT INTO announcements')) {
			return { rowCount: 1, rows: [{ id: '15', title: 'Service update', status: 'PUBLISHED' }] };
		}
		if (sql.includes('INSERT INTO audit_logs')) return { rowCount: 1, rows: [] };
		throw new Error(`Unexpected SQL in announcement creation: ${sql}`);
	};
	context.after(() => {
		pool.query = originalQuery;
	});

	const response = responseMock();
	await createAnnouncement({
		body: { title: 'Service update', body: 'The service begins at 10:00.', status: 'PUBLISHED' },
		user: { id: 4, permissions: ['announcements.manage'] },
	}, response);

	assert.equal(response.statusCode, 201);
	assert.equal(response.body.data.id, '15');
	assert.ok(statements.some(({ sql }) => sql.includes('featured, target_audience, delivery_channels')));
	assert.ok(statements.some(({ sql }) => sql.includes('INSERT INTO audit_logs')));
});

test('updates an existing announcement without dropping its group metadata', async (context) => {
	const originalQuery = pool.query;
	const statements = [];
	pool.query = async (sql, values) => {
		statements.push({ sql, values });
		if (sql.startsWith('SELECT * FROM announcements')) {
			return {
				rowCount: 1,
				rows: [{
					id: '15',
					title: 'Service update',
					body: 'Old details.',
					status: 'DRAFT',
					image_url: null,
					published_at: null,
					department_id: 7,
					organization_id: null,
					bible_study_group_id: null,
					event_id: null,
					program_id: null,
					featured: false,
					target_audience: 'DEPARTMENT',
					delivery_channels: ['WEBSITE'],
				}],
			};
		}
		if (sql.startsWith('UPDATE announcements')) {
			return { rowCount: 1, rows: [{ id: '15', title: 'Service update', status: 'PUBLISHED' }] };
		}
		if (sql.includes('INSERT INTO audit_logs')) return { rowCount: 1, rows: [] };
		throw new Error(`Unexpected SQL in announcement update: ${sql}`);
	};
	context.after(() => {
		pool.query = originalQuery;
	});

	const response = responseMock();
	await updateAnnouncement({
		params: { id: '15' },
		body: { body: 'New details.', status: 'PUBLISHED' },
		user: { id: 4, permissions: ['announcements.manage'] },
	}, response);

	assert.equal(response.statusCode, 200);
	assert.equal(response.body.data.status, 'PUBLISHED');
	assert.equal(statements[1].values[6], 7);
	assert.ok(statements.some(({ sql }) => sql.includes('INSERT INTO audit_logs')));
});
