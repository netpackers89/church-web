import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationDirectory = resolve(currentDirectory, '../migrations');

try {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`);
	const migrationNames = (await readdir(migrationDirectory))
		.filter((name) => /^\d+_.*\.sql$/.test(name))
		.sort();
	for (const migrationName of migrationNames) {
		const alreadyApplied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migrationName]);
		if (alreadyApplied.rowCount) {
			console.info(`[migration] ${migrationName} already applied.`);
			continue;
		}
		const sql = await readFile(resolve(migrationDirectory, migrationName), 'utf8');
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			await client.query(sql);
			await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
			await client.query('COMMIT');
			console.info(`[migration] ${migrationName} applied.`);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	}
} catch (error) {
	console.error('[migration] failed:', error.message);
	process.exitCode = 1;
} finally {
	await pool.end();
}