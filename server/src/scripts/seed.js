import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { DEFAULT_PERMISSION_CATALOG, ROLE_PERMISSION_MAP, expandPermissionAliases } from '../services/permissionCatalog.js';

const roles = ['SYSTEM_OWNER', 'ADMIN', 'PASTOR', 'LEADER', 'FINANCE', 'STAFF', 'MEMBER', 'PARTNER', 'REGISTRAR'];
const templates = [
	['daily-verse', 'TELEGRAM', 'Daily verse', '{{reference}}\n\n{{text}}'],
	['program-reminder', 'TELEGRAM', 'Program reminder', '{{program}} starts at {{startTime}}.'],
	['announcement', 'TELEGRAM', 'Church announcement', '{{title}}\n\n{{body}}'],
];

let client;
try {
	client = await pool.connect();
	await client.query('BEGIN');
	for (const code of roles) await client.query('INSERT INTO roles (code, name, is_system) VALUES ($1, $1, TRUE) ON CONFLICT (code) DO NOTHING', [code]);
	await client.query('ALTER TABLE permissions ADD COLUMN IF NOT EXISTS name VARCHAR(100)');
	await client.query(`UPDATE permissions SET name = COALESCE(NULLIF(btrim(name), ''), code)
		WHERE name IS NULL OR btrim(name) = ''`);
	for (const { code, description } of DEFAULT_PERMISSION_CATALOG) {
		await client.query(`INSERT INTO permissions (code, name, description)
			VALUES ($1, $2, $3)
			ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`, [code, code, description]);
	}
	for (const [roleCode, permissions] of Object.entries(ROLE_PERMISSION_MAP)) {
		const role = await client.query('SELECT id FROM roles WHERE code = $1', [roleCode]);
		if (!role.rowCount) continue;
		for (const permissionCode of expandPermissionAliases(permissions)) {
			await client.query(`INSERT INTO role_permissions (role_id, permission_id)
				SELECT $1, id FROM permissions WHERE code = $2
				ON CONFLICT DO NOTHING`, [role.rows[0].id, permissionCode]);
		}
	}
	for (const [code, channel, subject, body] of templates) {
		await client.query(`INSERT INTO notification_templates (code, channel, subject_template, body_template)
			VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO UPDATE SET subject_template = EXCLUDED.subject_template, body_template = EXCLUDED.body_template`, [code, channel, subject, body]);
	}
	const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
	const password = process.env.INITIAL_ADMIN_PASSWORD;
	const allowSeedAdmin = ['development', 'test'].includes(process.env.NODE_ENV) || process.env.ALLOW_INITIAL_ADMIN === 'true';
	if (email && password && allowSeedAdmin) {
		if (password.length < 14) throw new Error('INITIAL_ADMIN_PASSWORD must be at least 14 characters.');
		const hash = await bcrypt.hash(password, 12);
		const telegramUserId = process.env.INITIAL_ADMIN_TELEGRAM_USER_ID?.trim();
		const telegramChatId = process.env.INITIAL_ADMIN_TELEGRAM_CHAT_ID?.trim() || telegramUserId;
		if ((telegramUserId || telegramChatId) && (!/^\d+$/.test(telegramUserId || '') || !/^-?\d+$/.test(telegramChatId || ''))) {
			throw new Error('INITIAL_ADMIN_TELEGRAM_USER_ID and INITIAL_ADMIN_TELEGRAM_CHAT_ID must be numeric Telegram IDs.');
		}
		const user = await client.query(`INSERT INTO users (name,email,phone,password_hash,role,birth_date_ec,birth_date_gregorian,location,other_location)
			VALUES ($1,$2,$3,$4,'ADMIN','1980-01-01','1987-09-12','Other','Initial setup')
			ON CONFLICT (LOWER(email)) DO UPDATE SET role = 'ADMIN', password_hash = EXCLUDED.password_hash, phone = EXCLUDED.phone, updated_at = NOW()
			RETURNING id`, [process.env.INITIAL_ADMIN_NAME || 'Initial Administrator', email, process.env.INITIAL_ADMIN_PHONE || '+251900000000', hash]);
		const target = user.rows[0] || (await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email])).rows[0];
		await client.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = 'ADMIN' ON CONFLICT DO NOTHING`, [target.id]);
		if (telegramUserId) {
			const telegram = await client.query(`INSERT INTO telegram_accounts (telegram_user_id, chat_id, user_id, linked_at)
				VALUES ($1, $2, $3, NOW())
				ON CONFLICT (telegram_user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, user_id = EXCLUDED.user_id, linked_at = NOW(), updated_at = NOW()
				WHERE telegram_accounts.user_id IS NULL OR telegram_accounts.user_id = EXCLUDED.user_id
				RETURNING id`, [telegramUserId, telegramChatId, target.id]);
			if (!telegram.rowCount) throw new Error('That Telegram account is already linked to a different website account.');
			await client.query('UPDATE users SET telegram_chat_id = $2, notify_telegram = FALSE, updated_at = NOW() WHERE id = $1', [target.id, telegramChatId]);
		}
	}
	// A system owner is deliberately opt-in and can only be bootstrapped when
	// no active owner exists. It is not derived from the ordinary ADMIN seed.
	const ownerEmail = process.env.INITIAL_SYSTEM_OWNER_EMAIL?.trim().toLowerCase();
	const allowSeedOwner = ['development', 'test'].includes(process.env.NODE_ENV) || process.env.ALLOW_INITIAL_SYSTEM_OWNER === 'true';
	if (ownerEmail && allowSeedOwner) {
		const ownerCandidate = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE', [ownerEmail]);
		if (!ownerCandidate.rowCount) throw new Error('INITIAL_SYSTEM_OWNER_EMAIL must identify an existing account. Create the account through the secured initial-admin setup first.');
		const owners = await client.query(`SELECT count(*)::int AS count FROM users u
			JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
			WHERE u.account_status = 'ACTIVE' AND r.code = 'SYSTEM_OWNER'`);
		if (owners.rows[0].count === 0) {
			const ownerRole = await client.query("SELECT id FROM roles WHERE code = 'SYSTEM_OWNER'");
			if (!ownerRole.rowCount) throw new Error('SYSTEM_OWNER role is missing. Run migrations before seeding an owner.');
			await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ownerCandidate.rows[0].id, ownerRole.rows[0].id]);
			await client.query("UPDATE users SET role = 'SYSTEM_OWNER', updated_at = NOW() WHERE id = $1", [ownerCandidate.rows[0].id]);
			await client.query(`INSERT INTO user_role_assignment_history (user_id, role_id, reason)
				VALUES ($1, $2, 'Trusted initial owner bootstrap')
				ON CONFLICT (user_id, role_id) WHERE revoked_at IS NULL DO NOTHING`, [ownerCandidate.rows[0].id, ownerRole.rows[0].id]);
			console.info('[seed] initial system owner assigned.');
		}
	}
	await client.query('COMMIT');
	console.info('[seed] reference data is ready.');
} catch (error) {
	if (client) await client.query('ROLLBACK').catch(() => {});
	console.error('[seed] failed:', error.message);
	process.exitCode = 1;
} finally {
	client?.release();
	await pool.end();
}
