import { pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { config } from '../config/env.js';
import { checkTelegramBotStatus, sendTelegramNotification } from '../telegram/services/messaging.js';
import { pageParams, paged, requestError, requiredString } from '../utils/http.js';
import {
	findAutoReplyRule,
	MENU_ACTIONS,
	SUPPORTED_LANGUAGES,
	validateLocalized,
} from '../telegram/services/configuration.js';

function menuInput(body = {}) {
	const key = requiredString(body.key, 'Menu key', 64).toLowerCase();
	if (!/^[a-z][a-z0-9_]*$/.test(key)) throw Object.assign(new Error('Menu key must start with a letter and use only lowercase letters, numbers, and underscores.'), { status: 400 });
	const actionType = String(body.actionType ?? 'TEXT').toUpperCase();
	if (!MENU_ACTIONS.includes(actionType)) throw Object.assign(new Error('Select a supported menu action.'), { status: 400 });
	const visibility = String(body.visibility ?? 'EVERYONE').toUpperCase();
	if (!['EVERYONE', 'LINKED_MEMBER'].includes(visibility)) throw Object.assign(new Error('Select a supported visibility rule.'), { status: 400 });
	const labels = validateLocalized(body.labels, 'Button label', 64);
	const responses = actionType === 'TEXT'
		? validateLocalized(body.responses, 'Response', 4000)
		: (body.responses && typeof body.responses === 'object' ? body.responses : {});
	let targetUrl = null;
	if (actionType === 'URL') {
		try {
			const url = new URL(requiredString(body.targetUrl, 'URL', 2000));
			if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
			targetUrl = url.href;
		} catch {
			throw Object.assign(new Error('Menu URLs must be valid HTTPS links without credentials.'), { status: 400 });
		}
	}
	const sortOrder = Number(body.sortOrder ?? 0);
	if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) throw Object.assign(new Error('Sort order must be a whole number between 0 and 10000.'), { status: 400 });
	return { key, labels, responses, actionType, targetUrl, visibility, sortOrder, isActive: body.isActive === true };
}

function autoReplyInput(body = {}) {
	const name = requiredString(body.name, 'Rule name', 120);
	if (!Array.isArray(body.keywords) || body.keywords.length < 1 || body.keywords.length > 20) {
		throw Object.assign(new Error('Add between 1 and 20 keywords.'), { status: 400 });
	}
	const keywords = [...new Set(body.keywords.map((keyword) => requiredString(keyword, 'Keyword', 100)))];
	const matchType = String(body.matchType ?? 'CONTAINS').toUpperCase();
	if (!['EXACT', 'CONTAINS'].includes(matchType)) throw Object.assign(new Error('Match type must be EXACT or CONTAINS.'), { status: 400 });
	const responses = validateLocalized(body.responses, 'Response', 4000);
	const priority = Number(body.priority ?? 100);
	if (!Number.isInteger(priority) || priority < 0 || priority > 10000) throw Object.assign(new Error('Priority must be a whole number between 0 and 10000.'), { status: 400 });
	return { name, keywords, matchType, responses, priority, isActive: body.isActive === true };
}

export async function telegramManagementOverview(_request, response) {
	try {
		const [accounts, messages, menu, rules, updates] = await Promise.all([
			pool.query(`SELECT count(*)::int AS total,
				count(*) FILTER (WHERE user_id IS NOT NULL)::int AS linked
				FROM telegram_accounts`),
			pool.query(`SELECT count(*)::int AS total,
				count(*) FILTER (WHERE status='NEW')::int AS pending
				FROM telegram_messages`),
			pool.query(`SELECT count(*)::int AS total,
				count(*) FILTER (WHERE is_active)::int AS active
				FROM telegram_menu_items`),
			pool.query(`SELECT count(*)::int AS total,
				count(*) FILTER (WHERE is_active)::int AS active
				FROM telegram_auto_reply_rules`),
			pool.query(`SELECT count(*) FILTER (WHERE processing_status='FAILED')::int AS failed,
				max(processed_at) AS "lastProcessedAt"
				FROM telegram_updates`),
		]);
		return response.json({ success: true, data: {
			accounts: accounts.rows[0], messages: messages.rows[0], menuItems: menu.rows[0],
			autoReplies: rules.rows[0], updates: updates.rows[0], configured: Boolean(config.telegram.token),
		} });
	} catch (error) { return requestError(error, response); }
}

export async function checkTelegramConnection(request, response) {
	try {
		if (!config.telegram.token) throw Object.assign(new Error('Telegram bot is not configured on this server.'), { status: 503 });
		const status = await checkTelegramBotStatus();
		return response.json({ success: true, data: status });
	} catch (error) {
		if (error.status) return requestError(error, response);
		console.error('[telegram-admin] Connection check failed:', error.message);
		return response.status(502).json({ error: 'Telegram connection check failed. Verify the bot token and network access.' });
	}
}

export async function sendTelegramAdminTest(request, response) {
	try {
		if (!config.telegram.token) throw Object.assign(new Error('Telegram bot is not configured on this server.'), { status: 503 });
		const result = await pool.query(`SELECT telegram_chat_id AS "telegramChatId"
			FROM users WHERE id=$1 AND account_status='ACTIVE'`, [request.user.id]);
		const chatId = result.rows[0]?.telegramChatId;
		if (!chatId) throw Object.assign(new Error('Link your Telegram account before sending an administrator test message.'), { status: 409 });
		let delivery;
		try {
			delivery = await sendTelegramNotification({
				chatId,
				text: `Test message from ${config.branding.churchName}: administrator Telegram delivery is working.`,
			});
		} catch (error) {
			console.error('[telegram-admin] Test delivery failed:', error.message);
			return response.status(502).json({ error: 'Telegram did not accept the test message. Check the linked account and try again.' });
		}
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_ADMIN_SELF_TEST', entityType: 'telegram_account', after: { status: 'API_ACCEPTED', telegramMessageId: delivery.messageId }, ipAddress: clientIp(request) });
		return response.json({ success: true, data: { status: 'API_ACCEPTED', messageId: delivery.messageId }, message: 'Telegram accepted the test message. Check your linked chat.' });
	} catch (error) { return requestError(error, response); }
}

export async function listTelegramMenuItems(request, response) {
	try {
		const { page, limit, offset } = pageParams(request.query);
		const [rows, total] = await Promise.all([
			pool.query(`SELECT id,item_key AS key,label_i18n AS labels,response_i18n AS responses,
				action_type AS "actionType",target_url AS "targetUrl",visibility,sort_order AS "sortOrder",
				is_active AS "isActive",is_builtin AS "isBuiltin",updated_at AS "updatedAt"
				FROM telegram_menu_items ORDER BY sort_order,id LIMIT $1 OFFSET $2`, [limit, offset]),
			pool.query('SELECT count(*)::int AS total FROM telegram_menu_items'),
		]);
		const commands = [
			'start', 'programs', 'giving', 'campaigns', 'fundraising', 'receipts', 'myreceipts',
			'departments', 'mydepartments', 'bible', 'bible_studies', 'mybiblestudies', 'location',
			'signup', 'connect', 'profile', 'help', 'menu', 'cancel', 'newchristian', 'language', 'contact',
		].map((command) => ({ command: `/${command}`, source: 'Built-in handler' }));
		return response.json({ success: true, data: rows.rows, catalog: { commands },
			meta: { page, limit, total: total.rows[0].total, pages: Math.ceil(total.rows[0].total / limit) } });
	} catch (error) { return requestError(error, response); }
}

export async function createTelegramMenuItem(request, response) {
	try {
		const item = menuInput(request.body);
		const result = await pool.query(`INSERT INTO telegram_menu_items
			(item_key,label_i18n,response_i18n,action_type,target_url,visibility,sort_order,is_active,updated_by)
			VALUES($1,$2::jsonb,$3::jsonb,$4,$5,$6,$7,$8,$9)
			RETURNING id,item_key AS key,label_i18n AS labels,response_i18n AS responses,
			action_type AS "actionType",target_url AS "targetUrl",visibility,sort_order AS "sortOrder",is_active AS "isActive"`,
		[item.key, JSON.stringify(item.labels), JSON.stringify(item.responses), item.actionType, item.targetUrl, item.visibility, item.sortOrder, item.isActive, request.user.id]);
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_MENU_ITEM_CREATED', entityType: 'telegram_menu_item', entityId: result.rows[0].id, after: { key: item.key, actionType: item.actionType, isActive: item.isActive }, ipAddress: clientIp(request) });
		return response.status(201).json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function updateTelegramMenuItem(request, response) {
	try {
		const id = Number(request.params.id);
		if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('Menu item not found.'), { status: 404 });
		const item = menuInput(request.body);
		const existing = await pool.query(`SELECT item_key,is_builtin AS "isBuiltin" FROM telegram_menu_items WHERE id=$1`, [id]);
		if (!existing.rowCount) throw Object.assign(new Error('Menu item not found.'), { status: 404 });
		if (existing.rows[0].isBuiltin && item.key !== existing.rows[0].item_key) {
			throw Object.assign(new Error('Built-in menu keys cannot be changed.'), { status: 400 });
		}
		const result = await pool.query(`UPDATE telegram_menu_items SET item_key=$2,label_i18n=$3::jsonb,
			response_i18n=$4::jsonb,action_type=$5,target_url=$6,visibility=$7,sort_order=$8,is_active=$9,
			updated_by=$10,updated_at=NOW() WHERE id=$1
			RETURNING id,item_key AS key,label_i18n AS labels,response_i18n AS responses,
			action_type AS "actionType",target_url AS "targetUrl",visibility,sort_order AS "sortOrder",is_active AS "isActive"`,
		[id, item.key, JSON.stringify(item.labels), JSON.stringify(item.responses), item.actionType, item.targetUrl, item.visibility, item.sortOrder, item.isActive, request.user.id]);
		if (!result.rowCount) throw Object.assign(new Error('Menu item not found.'), { status: 404 });
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_MENU_ITEM_UPDATED', entityType: 'telegram_menu_item', entityId: id, after: { key: item.key, actionType: item.actionType, isActive: item.isActive }, ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function deleteTelegramMenuItem(request, response) {
	try {
		const id = Number(request.params.id);
		if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('Menu item not found.'), { status: 404 });
		const result = await pool.query('DELETE FROM telegram_menu_items WHERE id=$1 AND is_builtin=FALSE RETURNING id,item_key', [id]);
		if (!result.rowCount) {
			const builtIn = await pool.query('SELECT id FROM telegram_menu_items WHERE id=$1 AND is_builtin=TRUE', [id]);
			if (builtIn.rowCount) throw Object.assign(new Error('Built-in menu actions cannot be deleted. Disable them or edit their translations instead.'), { status: 409 });
		}
		if (!result.rowCount) throw Object.assign(new Error('Menu item not found.'), { status: 404 });
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_MENU_ITEM_DELETED', entityType: 'telegram_menu_item', entityId: id, before: { key: result.rows[0].item_key }, ipAddress: clientIp(request) });
		return response.json({ success: true, data: { id: result.rows[0].id } });
	} catch (error) { return requestError(error, response); }
}

export async function listTelegramAutoReplies(request, response) {
	try {
		const { page, limit, offset } = pageParams(request.query);
		const [rows, total] = await Promise.all([
			pool.query(`SELECT id,name,keywords,match_type AS "matchType",response_i18n AS responses,
				priority,is_active AS "isActive",updated_at AS "updatedAt"
				FROM telegram_auto_reply_rules ORDER BY priority,id LIMIT $1 OFFSET $2`, [limit, offset]),
			pool.query('SELECT count(*)::int AS total FROM telegram_auto_reply_rules'),
		]);
		return paged(response, rows.rows, { page, limit }, total.rows[0].total);
	} catch (error) { return requestError(error, response); }
}

export async function createTelegramAutoReply(request, response) {
	try {
		const rule = autoReplyInput(request.body);
		const result = await pool.query(`INSERT INTO telegram_auto_reply_rules(name,keywords,match_type,response_i18n,priority,is_active,updated_by)
			VALUES($1,$2::jsonb,$3,$4::jsonb,$5,$6,$7)
			RETURNING id,name,keywords,match_type AS "matchType",response_i18n AS responses,priority,is_active AS "isActive"`,
		[rule.name, JSON.stringify(rule.keywords), rule.matchType, JSON.stringify(rule.responses), rule.priority, rule.isActive, request.user.id]);
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_AUTO_REPLY_CREATED', entityType: 'telegram_auto_reply_rule', entityId: result.rows[0].id, after: { name: rule.name, isActive: rule.isActive }, ipAddress: clientIp(request) });
		return response.status(201).json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function updateTelegramAutoReply(request, response) {
	try {
		const id = Number(request.params.id);
		if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('Auto-reply rule not found.'), { status: 404 });
		const rule = autoReplyInput(request.body);
		const result = await pool.query(`UPDATE telegram_auto_reply_rules SET name=$2,keywords=$3::jsonb,
			match_type=$4,response_i18n=$5::jsonb,priority=$6,is_active=$7,updated_by=$8,updated_at=NOW()
			WHERE id=$1 RETURNING id,name,keywords,match_type AS "matchType",response_i18n AS responses,
			priority,is_active AS "isActive"`,
		[id, rule.name, JSON.stringify(rule.keywords), rule.matchType, JSON.stringify(rule.responses), rule.priority, rule.isActive, request.user.id]);
		if (!result.rowCount) throw Object.assign(new Error('Auto-reply rule not found.'), { status: 404 });
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_AUTO_REPLY_UPDATED', entityType: 'telegram_auto_reply_rule', entityId: id, after: { name: rule.name, isActive: rule.isActive }, ipAddress: clientIp(request) });
		return response.json({ success: true, data: result.rows[0] });
	} catch (error) { return requestError(error, response); }
}

export async function deleteTelegramAutoReply(request, response) {
	try {
		const id = Number(request.params.id);
		if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('Auto-reply rule not found.'), { status: 404 });
		const result = await pool.query('DELETE FROM telegram_auto_reply_rules WHERE id=$1 RETURNING id,name', [id]);
		if (!result.rowCount) throw Object.assign(new Error('Auto-reply rule not found.'), { status: 404 });
		await audit({ actorUserId: request.user.id, action: 'TELEGRAM_AUTO_REPLY_DELETED', entityType: 'telegram_auto_reply_rule', entityId: id, before: { name: result.rows[0].name }, ipAddress: clientIp(request) });
		return response.json({ success: true, data: { id: result.rows[0].id } });
	} catch (error) { return requestError(error, response); }
}

export async function previewTelegramAutoReply(request, response) {
	try {
		const text = requiredString(request.body?.text, 'Test message', 1000);
		const result = await pool.query(`SELECT id,name,keywords,match_type AS "matchType",response_i18n AS responses,priority
			FROM telegram_auto_reply_rules WHERE is_active=TRUE ORDER BY priority,id`);
		const match = findAutoReplyRule(result.rows, text);
		return response.json({ success: true, data: {
			matched: Boolean(match), rule: match ? { id: match.id, name: match.name, matchType: match.matchType } : null,
			responses: match?.responses ?? Object.fromEntries(SUPPORTED_LANGUAGES.map((language) => [language, ''])),
		} });
	} catch (error) { return requestError(error, response); }
}
