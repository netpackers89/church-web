import { completeTelegramLink } from './userController.js';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { requestError } from '../utils/http.js';

function sender(message) {
	const from = message?.from;
	if (!from || !Number.isSafeInteger(Number(from.id))) return null;
	return { telegramUserId: Number(from.id), chatId: Number(message.chat?.id), username: from.username || null, displayName: [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 160) || null };
}

export async function telegramWebhook(request, response) {
	try {
		if (!config.telegramWebhookSecret || request.get('x-telegram-bot-api-secret-token') !== config.telegramWebhookSecret) return response.status(401).json({ error: 'Invalid Telegram webhook secret.' });
		const update = request.body;
		if (!Number.isSafeInteger(Number(update?.update_id))) return response.status(400).json({ error: 'Invalid Telegram update.' });
		const received = await pool.query(`INSERT INTO telegram_updates(telegram_update_id,payload) VALUES($1,$2::jsonb) ON CONFLICT(telegram_update_id) DO NOTHING RETURNING id`, [update.update_id, JSON.stringify(update)]);
		if (!received.rowCount) return response.status(200).json({ ok: true, duplicate: true });
		const message = update.message;
		const identity = sender(message);
		if (identity && Number.isSafeInteger(identity.chatId)) {
			const account = await pool.query(`INSERT INTO telegram_accounts(telegram_user_id,chat_id,username,display_name) VALUES($1,$2,$3,$4)
				ON CONFLICT(telegram_user_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,username=EXCLUDED.username,display_name=EXCLUDED.display_name,updated_at=NOW() RETURNING id`, [identity.telegramUserId,identity.chatId,identity.username,identity.displayName]);
			if (message?.message_id) await pool.query(`INSERT INTO telegram_messages(telegram_update_id,telegram_account_id,telegram_message_id,chat_id,content,content_type,received_at)
				VALUES($1,$2,$3,$4,$5,$6,to_timestamp($7)) ON CONFLICT(chat_id,telegram_message_id) DO NOTHING`, [received.rows[0].id,account.rows[0].id,message.message_id,identity.chatId,message.text || message.caption || null,message.text ? 'text' : 'unsupported',message.date || Math.floor(Date.now()/1000)]);
			const start = message?.text?.match(/^\/start\s+([A-Za-z0-9_-]{40,60})$/);
			if (start && message.chat?.type === 'private') await completeTelegramLink(start[1], identity);
		}
		await pool.query(`UPDATE telegram_updates SET processing_status='PROCESSED',processed_at=NOW() WHERE id=$1`, [received.rows[0].id]);
		return response.status(200).json({ ok: true });
	} catch (error) {
		if (request.body?.update_id) await pool.query(`UPDATE telegram_updates SET processing_status='FAILED',error_detail=$2 WHERE telegram_update_id=$1`, [request.body.update_id,error.message]).catch(() => {});
		return requestError(error, response);
	}
}
