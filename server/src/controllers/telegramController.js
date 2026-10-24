import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { handleTelegramUpdate } from '../telegram/index.js';
import { requestError } from '../utils/http.js';

function sender(message, fallbackFrom) {
	const from = fallbackFrom ?? message?.from;
	if (!from || !Number.isSafeInteger(Number(from.id))) return null;
	return { telegramUserId: Number(from.id), chatId: Number(message.chat?.id), username: from.username || null, displayName: [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 160) || null };
}

export async function telegramWebhook(request, response) {
	try {
		if (!config.telegramWebhookSecret || request.get('x-telegram-bot-api-secret-token') !== config.telegramWebhookSecret) return response.status(401).json({ error: 'Invalid Telegram webhook secret.' });
		if (!config.telegram.token) return response.status(503).json({ error: 'Telegram bot is not configured.' });
		const update = request.body;
		if (!Number.isSafeInteger(Number(update?.update_id))) return response.status(400).json({ error: 'Invalid Telegram update.' });
		const received = await pool.query(`INSERT INTO telegram_updates(telegram_update_id,payload,processing_status)
			VALUES($1,$2::jsonb,'PROCESSING')
			ON CONFLICT(telegram_update_id) DO UPDATE SET payload=EXCLUDED.payload,processing_status='PROCESSING',
				processed_at=NULL,error_detail=NULL,updated_at=NOW()
			WHERE telegram_updates.processing_status='FAILED'
				OR (telegram_updates.processing_status='PROCESSING' AND telegram_updates.updated_at<NOW()-INTERVAL '5 minutes')
			RETURNING id`, [update.update_id, JSON.stringify(update)]);
		if (!received.rowCount) return response.status(200).json({ ok: true, duplicate: true });
		const message = update.message ?? update.edited_message ?? update.channel_post;
		const identity = sender(message, update.inline_query?.from);
		if (identity && Number.isSafeInteger(identity.chatId)) {
			let accountId = null;
			if (message?.chat?.type === 'private') {
				const account = await pool.query(`INSERT INTO telegram_accounts(telegram_user_id,chat_id,username,display_name) VALUES($1,$2,$3,$4)
					ON CONFLICT(telegram_user_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,username=EXCLUDED.username,display_name=EXCLUDED.display_name,updated_at=NOW() RETURNING id`, [identity.telegramUserId,identity.chatId,identity.username,identity.displayName]);
				accountId = account.rows[0]?.id ?? null;
			}
			if (message?.message_id && !update.callback_query) await pool.query(`INSERT INTO telegram_messages(telegram_update_id,telegram_account_id,telegram_message_id,chat_id,content,content_type,received_at)
				VALUES($1,$2,$3,$4,$5,$6,to_timestamp($7))
				ON CONFLICT(chat_id,telegram_message_id) WHERE telegram_message_id IS NOT NULL DO NOTHING`,
			[received.rows[0].id,accountId,message.message_id,identity.chatId,message.text || message.caption || '[unsupported Telegram update]',message.text ? 'text' : message.caption ? 'caption' : 'unsupported',message.date || Math.floor(Date.now()/1000)]);
		}
		await handleTelegramUpdate(update);
		await pool.query(`UPDATE telegram_updates SET processing_status='PROCESSED',processed_at=NOW(),updated_at=NOW(),error_detail=NULL WHERE id=$1`, [received.rows[0].id]);
		return response.status(200).json({ ok: true });
	} catch (error) {
		if (request.body?.update_id) {
			try {
				await pool.query(`UPDATE telegram_updates SET processing_status='FAILED',error_detail=$2,updated_at=NOW() WHERE telegram_update_id=$1`, [request.body.update_id,error.message]);
			} catch (statusError) {
				console.error('[telegram-webhook] Could not persist failed update status:', statusError.message);
			}
		}
		return requestError(error, response);
	}
}
