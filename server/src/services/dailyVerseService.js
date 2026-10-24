import cron from 'node-cron';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';

let dailyVerseTask;

export function churchDate(date = new Date()) {
	const values = new Intl.DateTimeFormat('en-CA', { timeZone: config.churchTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
	const part = (type) => values.find((item) => item.type === type)?.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function publishAutomaticDailyVerse(forDate = churchDate()) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const existing = await client.query(`SELECT id FROM daily_verse_publications
			WHERE publication_date = $1 AND status IN ('SCHEDULED','PUBLISHED') FOR UPDATE`, [forDate]);
		if (existing.rowCount) { await client.query('COMMIT'); return { created: false, id: existing.rows[0].id }; }
		const verse = await client.query(`SELECT v.id FROM bible_verses v
			WHERE v.verified_at IS NOT NULL AND NOT EXISTS (
				SELECT 1 FROM daily_verse_publications p WHERE p.verse_id = v.id
				AND p.publication_date >= $1::date - INTERVAL '30 days' AND p.status = 'PUBLISHED'
			)
			ORDER BY random() LIMIT 1`, [forDate]);
		if (!verse.rowCount) { await client.query('COMMIT'); return { created: false, reason: 'No verified verse is available.' }; }
		const result = await client.query(`INSERT INTO daily_verse_publications
			(verse_id, publication_date, publication_source, status, publish_to_website, published_at)
			VALUES ($1,$2,'AUTOMATIC','PUBLISHED',TRUE,NOW()) RETURNING id`, [verse.rows[0].id, forDate]);
		await client.query(`INSERT INTO bible_verse_publication_history (publication_id, action, snapshot)
			VALUES ($1,'PUBLISHED',jsonb_build_object('source','AUTOMATIC'))`, [result.rows[0].id]);
		await client.query('COMMIT');
		return { created: true, id: result.rows[0].id };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally { client.release(); }
}

export function startDailyVerseScheduler() {
	if (dailyVerseTask) return dailyVerseTask;
	// Safe to execute more than once: the database partial unique index is the
	// final idempotency guard, even with multiple application processes.
	dailyVerseTask = cron.schedule('5 0 * * *', () => {
		void publishAutomaticDailyVerse().catch((error) => console.error('[daily-verse] publication failed:', error.message));
	}, { timezone: config.churchTimezone });
	return dailyVerseTask;
}

export function stopDailyVerseScheduler() {
	dailyVerseTask?.stop();
	dailyVerseTask = undefined;
}
