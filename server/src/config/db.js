import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;
const pool = new Pool({
	...(config.database.url
		? { connectionString: config.database.url }
		: {
			host: config.database.host,
			port: config.database.port,
			database: config.database.name,
			user: config.database.user,
			password: config.database.password,
			ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
		}),
	connectionTimeoutMillis: 5000,
	idleTimeoutMillis: 30000,
});

let schemaPromise;

export async function ensureDatabaseReady() {
	if (!schemaPromise) {
		schemaPromise = pool.query(`
			CREATE TABLE IF NOT EXISTS notification_recipients (
				id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
				name VARCHAR(120) NOT NULL,
				email VARCHAR(320),
				telegram_chat_id VARCHAR(100),
				phone VARCHAR(40),
				group_name VARCHAR(80),
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				CONSTRAINT recipient_has_contact CHECK (email IS NOT NULL OR telegram_chat_id IS NOT NULL)
			);
			CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_email_unique
				ON notification_recipients (LOWER(email)) WHERE email IS NOT NULL;
			CREATE UNIQUE INDEX IF NOT EXISTS notification_recipients_telegram_unique
				ON notification_recipients (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
		`);
	}

	try {
		await schemaPromise;
	} catch (error) {
		schemaPromise = undefined;
		throw error;
	}
}

export async function createUser({
	name,
	firstName,
	fatherName,
	grandfatherName,
	email,
	phone,
	passwordHash,
	birthDateEc,
	birthDateGregorian,
	location,
	otherLocation,
	profileImageUrl,
	notifyEmail,
	preferredLanguage,
	role = 'MEMBER',
	accountStatus = 'ACTIVE',
	departmentIds = [],
	bibleStudyGroupIds = [],
	departmentMemberRole = 'MEMBER',
	bibleStudyMemberRole = 'MEMBER',
}) {
	const result = await pool.query(
		`INSERT INTO users (
			name, first_name, father_name, grandfather_name, profile_image_url,
			email, phone, password_hash, role, account_status, preferred_language,
			birth_date_ec, birth_date_gregorian, location, other_location,
			notify_email, notify_telegram, email_verified, phone_verified
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, FALSE, FALSE, FALSE)
		RETURNING id, name, email, phone, role, account_status AS "accountStatus",
			first_name AS "firstName", father_name AS "fatherName", grandfather_name AS "grandfatherName",
			profile_image_url AS "profileImageUrl",
			preferred_language AS "preferredLanguage", email_verified AS "emailVerified", phone_verified AS "phoneVerified",
			birth_date_ec AS "birthDateEc", TO_CHAR(birth_date_gregorian, 'YYYY-MM-DD') AS "birthDateGregorian",
			location, other_location AS "otherLocation", notify_email AS "notifyEmail",
			notify_telegram AS "notifyTelegram",
			created_at AS "createdAt", updated_at AS "updatedAt"`,
		[name, firstName, fatherName, grandfatherName, profileImageUrl, email, phone, passwordHash, role, accountStatus, preferredLanguage, birthDateEc, birthDateGregorian, location, otherLocation, notifyEmail],
	);
	const userId = result.rows[0].id;

	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		if (role && role !== 'MEMBER') {
			await client.query(
				'INSERT INTO user_roles (user_id, role_id, assigned_by) SELECT $1, id, NULL FROM roles WHERE code = $2',
				[userId, role],
			);
		}
		for (const [entityTable, entityIdColumn, entityIds, memberRole] of [
			['department_members', 'department_id', departmentIds, departmentMemberRole],
			['bible_study_memberships', 'bible_study_group_id', bibleStudyGroupIds, bibleStudyMemberRole],
		]) {
			for (const id of entityIds) {
				await client.query(
					`INSERT INTO ${entityTable} (user_id, ${entityIdColumn}, role) VALUES ($1, $2, $3)`,
					[userId, id, memberRole],
				);
			}
		}
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
	}

	return result.rows[0];
}

export async function findUserByEmail(email) {
	const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
	return result.rows[0] ?? null;
}

export async function findUserById(id) {
	const result = await pool.query(
		`SELECT id, name, first_name AS "firstName", father_name AS "fatherName",
			grandfather_name AS "grandfatherName", profile_image_url AS "profileImageUrl",
			email, phone, role, account_status AS "accountStatus",
			preferred_language AS "preferredLanguage", email_verified AS "emailVerified",
			phone_verified AS "phoneVerified",
			birth_date_ec AS "birthDateEc", TO_CHAR(birth_date_gregorian, 'YYYY-MM-DD') AS "birthDateGregorian",
			location, other_location AS "otherLocation", notify_email AS "notifyEmail",
			notify_telegram AS "notifyTelegram", telegram_chat_id AS "telegramChatId",
			(SELECT ta.username FROM telegram_accounts ta WHERE ta.user_id=users.id ORDER BY ta.linked_at DESC NULLS LAST LIMIT 1) AS "telegramUsername",
			(SELECT ta.linked_at FROM telegram_accounts ta WHERE ta.user_id=users.id ORDER BY ta.linked_at DESC NULLS LAST LIMIT 1) AS "telegramLinkedAt",
			created_at AS "createdAt", updated_at AS "updatedAt"
		 FROM users WHERE id = $1`,
		[id],
	);
	return result.rows[0] ?? null;
}

export async function listUsers() {
	const result = await pool.query(
		`SELECT id, name, first_name AS "firstName", father_name AS "fatherName",
			grandfather_name AS "grandfatherName", profile_image_url AS "profileImageUrl",
			email, phone, role, account_status AS "accountStatus",
			email_verified AS "emailVerified", phone_verified AS "phoneVerified",
			location, other_location AS "otherLocation",
			preferred_language AS "preferredLanguage",
			(SELECT status FROM member_welcome_deliveries d WHERE d.user_id=users.id AND d.channel='EMAIL') AS "welcomeEmailStatus",
			(SELECT status FROM member_welcome_deliveries d WHERE d.user_id=users.id AND d.channel='TELEGRAM') AS "welcomeTelegramStatus",
			created_at AS "createdAt"
		 FROM users ORDER BY created_at DESC, id DESC`,
	);
	return result.rows;
}

export async function updateUserProfile(id, fields) {
	const columnMap = {
		name: 'name',
		profileImageUrl: 'profile_image_url',
		phone: 'phone',
		birthDateEc: 'birth_date_ec',
		birthDateGregorian: 'birth_date_gregorian',
		location: 'location',
		otherLocation: 'other_location',
		preferredLanguage: 'preferred_language',
	};
	const entries = Object.entries(fields).filter(([key]) => columnMap[key]);
	if (!entries.length) return findUserById(id);
	const assignments = entries.map(([key], index) => `${columnMap[key]} = $${index + 2}`);
	if (fields.phone !== undefined) assignments.push('phone_verified = FALSE');
	const values = entries.map(([, value]) => value);
	const result = await pool.query(
		`UPDATE users SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $1
		 RETURNING id, name, first_name AS "firstName", father_name AS "fatherName",
			grandfather_name AS "grandfatherName", profile_image_url AS "profileImageUrl",
			email, phone, role, account_status AS "accountStatus",
			preferred_language AS "preferredLanguage", email_verified AS "emailVerified",
			phone_verified AS "phoneVerified",
			birth_date_ec AS "birthDateEc", TO_CHAR(birth_date_gregorian, 'YYYY-MM-DD') AS "birthDateGregorian",
			location, other_location AS "otherLocation", notify_email AS "notifyEmail",
			notify_telegram AS "notifyTelegram", telegram_chat_id AS "telegramChatId",
			created_at AS "createdAt", updated_at AS "updatedAt"`,
		[id, ...values],
	);
	return result.rows[0] ?? null;
}

export async function updateUserPreferences(id, { notifyEmail, notifyTelegram }) {
	const result = await pool.query(
		`UPDATE users SET notify_email = COALESCE($2, notify_email),
			notify_telegram = COALESCE($3, notify_telegram), updated_at = NOW()
		 WHERE id = $1 RETURNING id, notify_email AS "notifyEmail", notify_telegram AS "notifyTelegram"`,
		[id, notifyEmail, notifyTelegram],
	);
	return result.rows[0] ?? null;
}

export async function updateUserPassword(id, passwordHash) {
	await pool.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [id, passwordHash]);
}

export async function invalidateUserSessions(id) {
	await pool.query('UPDATE users SET session_version = session_version + 1, updated_at = NOW() WHERE id = $1', [id]);
}

export async function createEmailChangeToken(userId, newEmail, tokenHash) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const user = await client.query('SELECT email FROM users WHERE id = $1 FOR UPDATE', [userId]);
		if (!user.rowCount) throw Object.assign(new Error('Account no longer exists.'), { status: 404 });
		if (user.rows[0].email.toLowerCase() === newEmail.toLowerCase()) {
			throw Object.assign(new Error('That is already your current email address.'), { status: 400 });
		}
		const duplicate = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [newEmail]);
		if (duplicate.rowCount) throw Object.assign(new Error('That email address is already registered.'), { status: 409 });
		await client.query('UPDATE email_change_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
		await client.query('DELETE FROM email_change_tokens WHERE expires_at < NOW() - INTERVAL \'30 days\'');
		await client.query(
			`INSERT INTO email_change_tokens (user_id, new_email, token_hash, expires_at)
			 VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`,
			[userId, newEmail, tokenHash],
		);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

export async function verifyEmailChangeToken(tokenHash) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const token = await client.query(
			`SELECT id, user_id, new_email FROM email_change_tokens
			 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE`,
			[tokenHash],
		);
		if (!token.rowCount) throw Object.assign(new Error('This email verification link is invalid, expired, or already used.'), { status: 400 });
		const { id: tokenId, user_id: userId, new_email: newEmail } = token.rows[0];
		const updated = await client.query(
			`UPDATE users SET email = $2, email_verified = TRUE, updated_at = NOW()
			 WHERE id = $1 RETURNING id`,
			[userId, newEmail],
		);
		if (!updated.rowCount) throw Object.assign(new Error('Account no longer exists.'), { status: 404 });
		await client.query('UPDATE email_change_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);
		await client.query('COMMIT');
		return userId;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

export async function createTelegramLinkToken(userId, tokenHash) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const user = await client.query('SELECT telegram_chat_id FROM users WHERE id = $1 FOR UPDATE', [userId]);
		if (!user.rowCount) throw Object.assign(new Error('Account no longer exists.'), { status: 404 });
		if (user.rows[0].telegram_chat_id) throw Object.assign(new Error('A Telegram account is already connected. Unlink it before connecting another.'), { status: 409 });
		await client.query('DELETE FROM telegram_link_tokens WHERE expires_at < NOW() - INTERVAL \'30 days\'');
		await client.query('UPDATE telegram_link_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
		await client.query(
			'INSERT INTO telegram_link_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'5 minutes\')',
			[userId, tokenHash],
		);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

export async function getTelegramLinkStatus(userId, tokenHash) {
	const result = await pool.query(
		`SELECT t.expires_at > NOW() AS "tokenActive",
			t.used_at IS NOT NULL AS "tokenConsumed",
		u.telegram_chat_id IS NOT NULL AS connected,
		ta.username AS "telegramUsername",
		ta.linked_at AS "telegramLinkedAt"
		FROM telegram_link_tokens t
		JOIN users u ON u.id=t.user_id
		LEFT JOIN telegram_accounts ta ON ta.user_id=u.id
		WHERE t.user_id=$1 AND t.token_hash=$2
		ORDER BY t.created_at DESC LIMIT 1`,
		[userId, tokenHash],
	);
	if (!result.rowCount) throw Object.assign(new Error('This Telegram connection request was not found.'), { status: 404 });
	const link = result.rows[0];
	if (link.connected) return { status: 'CONNECTED', username: link.telegramUsername, linkedAt: link.telegramLinkedAt };
	return { status: link.tokenActive && !link.tokenConsumed ? 'PENDING' : 'EXPIRED' };
}

export async function connectTelegramByToken(tokenHash, { telegramUserId, chatId, username = null, displayName = null }) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const link = await client.query(
			`SELECT id, user_id FROM telegram_link_tokens
			 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW() FOR UPDATE`,
			[tokenHash],
		);
		if (!link.rowCount) throw Object.assign(new Error('This Telegram link is invalid, expired, or already used.'), { status: 400 });
		const userId = link.rows[0].user_id;
		if (!Number.isSafeInteger(Number(telegramUserId)) || !Number.isSafeInteger(Number(chatId))) throw Object.assign(new Error('Invalid Telegram identity.'), { status: 400 });
		const account = await client.query(`INSERT INTO telegram_accounts (telegram_user_id,chat_id,username,display_name,user_id,linked_at)
			VALUES($1,$2,$3,$4,$5,NOW())
			ON CONFLICT (telegram_user_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,username=EXCLUDED.username,display_name=EXCLUDED.display_name,updated_at=NOW()
			WHERE telegram_accounts.user_id IS NULL OR telegram_accounts.user_id = EXCLUDED.user_id
			RETURNING id,user_id`, [telegramUserId, chatId, username?.slice(0, 64) || null, displayName?.slice(0, 160) || null, userId]);
		if (!account.rowCount || String(account.rows[0].user_id) !== String(userId)) throw Object.assign(new Error('This Telegram account is already connected.'), { status: 409 });
		await client.query(
			'UPDATE users SET telegram_chat_id = $2, updated_at = NOW() WHERE id = $1 AND telegram_chat_id IS NULL',
			[userId, String(chatId)],
		);
		const linkedUser = await client.query('SELECT telegram_chat_id FROM users WHERE id = $1', [userId]);
		if (linkedUser.rows[0]?.telegram_chat_id !== String(chatId)) {
			throw Object.assign(new Error('This account or Telegram account is already connected.'), { status: 409 });
		}
		await client.query('UPDATE telegram_link_tokens SET used_at = NOW() WHERE id = $1', [link.rows[0].id]);
		await client.query('COMMIT');
		return userId;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

export async function disconnectTelegram(userId) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query('UPDATE telegram_accounts SET user_id=NULL,linked_at=NULL,updated_at=NOW() WHERE user_id=$1', [userId]);
		await client.query('UPDATE users SET telegram_chat_id = NULL, notify_telegram = FALSE, updated_at = NOW() WHERE id = $1', [userId]);
		await client.query('COMMIT');
	} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export { pool };
