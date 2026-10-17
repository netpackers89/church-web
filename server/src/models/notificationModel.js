import { ensureDatabaseReady, pool } from '../config/db.js';

export async function createRecipient({ name, email, telegramChatId, phone, groupName }) {
	await ensureDatabaseReady();
	const result = await pool.query(
		`INSERT INTO notification_recipients
			(name, email, telegram_chat_id, phone, group_name)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, name, email, telegram_chat_id AS "telegramChatId",
			phone, group_name AS "groupName", created_at AS "createdAt"`,
		[name, email, telegramChatId, phone, groupName],
	);
	return result.rows[0];
}

export async function findRecipients({ recipientIds, groupName }) {
	await ensureDatabaseReady();
	if (recipientIds) {
		const result = await pool.query(
			`SELECT id, name, email, telegram_chat_id AS "telegramChatId",
				phone, group_name AS "groupName"
			 FROM notification_recipients WHERE id = ANY($1::bigint[]) ORDER BY id`,
			[recipientIds],
		);
		return result.rows;
	}

	const result = await pool.query(
		`SELECT id, name, email, telegram_chat_id AS "telegramChatId",
			phone, group_name AS "groupName"
		 FROM notification_recipients WHERE group_name = $1 ORDER BY id`,
		[groupName],
	);
	return result.rows;
}

export async function listRecipients() {
	await ensureDatabaseReady();
	const result = await pool.query(
		`SELECT id, name, email, telegram_chat_id AS "telegramChatId",
			phone, group_name AS "groupName", created_at AS "createdAt"
		 FROM notification_recipients ORDER BY id DESC LIMIT 500`,
	);
	return result.rows;
}
