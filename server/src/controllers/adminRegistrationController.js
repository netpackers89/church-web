import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { createUser, pool } from '../config/db.js';
import { audit, clientIp } from '../services/auditService.js';
import { requestError, requiredString } from '../utils/http.js';
import { assertRoleAssignmentAllowed } from '../services/roleAssignmentPolicy.js';
import { isSafeImageUrl } from '../services/imgbbService.js';
import { config } from '../config/env.js';

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerStaff(request, response) {
  let client;
  try {
    if (!(request.user?.permissions ?? []).includes('roles.manage')) {
      throw fail('Role-management permission is required to register a staff account.', 403);
    }
    const fullName = requiredString(request.body?.fullName, 'Full name', 160);
    const emailRaw = String(request.body?.email || '').trim().toLowerCase();
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      throw fail('A valid email address is required.', 400);
    }
    if (emailRaw.length > 320) throw fail('Email address is too long.', 400);

    const phoneInput = request.body?.phone;
    let phone = null;
    if (typeof phoneInput === 'string' && phoneInput.trim()) {
      phone = phoneInput.trim();
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        throw fail('Enter a valid phone number in international format (e.g. +251912345678).', 400);
      }
    }

    const profileImageUrl = String(request.body?.profileImageUrl || '').trim();
    if (profileImageUrl && !isSafeImageUrl(profileImageUrl, config.mediaAllowedHosts)) {
      throw fail('Use a valid HTTPS profile image URL from approved media storage.', 400);
    }

    const role = String(request.body?.role || 'STAFF').toUpperCase();
    assertRoleAssignmentAllowed({ actorRoles: request.user.roles, actorPermissions: request.user.permissions, nextRoles: [role], actorId: request.user.id, targetUserId: 'new-staff-account' });

    const accountStatus = String(request.body?.accountStatus || 'PENDING_ACTIVATION').toUpperCase();
    if (accountStatus !== 'PENDING_ACTIVATION') {
      throw fail('New staff accounts must be activated with a password before they can sign in.', 400);
    }

    const departmentId = request.body?.departmentId || null;
    const bibleStudyGroupId = request.body?.bibleStudyGroupId || null;

    client = await pool.connect();
    await client.query('BEGIN');

    const roleCheck = await client.query('SELECT id FROM roles WHERE code = $1', [role]);
    if (!roleCheck.rowCount) throw fail('The assigned role does not exist.', 400);

    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [emailRaw]);
    if (existing.rowCount) throw fail('A user with that email address already exists.', 409);

    const activationToken = randomBytes(32).toString('base64url');
    const user = await createUser({
      name: fullName,
      email: emailRaw,
      phone,
      profileImageUrl,
      passwordHash: null,
      role,
      accountStatus,
      departmentIds: departmentId ? [Number(departmentId)] : [],
      bibleStudyGroupIds: bibleStudyGroupId ? [Number(bibleStudyGroupId)] : [],
      departmentMemberRole: role === 'LEADER' && departmentId ? 'LEADER' : 'MEMBER',
      bibleStudyMemberRole: role === 'LEADER' && bibleStudyGroupId ? 'LEADER' : 'MEMBER',
      queryable: client,
    });

    const userId = user.id;
    const tokenHash = hashToken(activationToken);
    await client.query(
      `INSERT INTO account_activation_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [userId, tokenHash],
    );

    await audit({
      actorUserId: request.user.id,
      action: 'STAFF_REGISTERED',
      entityType: 'user',
      entityId: userId,
      after: { id: userId, name: fullName, email: emailRaw, role, accountStatus, departmentId, bibleStudyGroupId },
      ipAddress: clientIp(request),
    }, client);

    await client.query('COMMIT');
    return response.status(201).json({ success: true, data: { user, activationToken } });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return requestError(error, response);
  } finally {
    client?.release();
  }
}

export async function activateAccount(request, response) {
  let client;
  try {
    const token = String(request.body?.token || '');
    const password = request.body?.password;
    if (!token) throw fail('Activation token is required.', 400);
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      throw fail('Password must be between 10 and 128 characters.', 400);
    }
    if (Buffer.byteLength(password, 'utf8') > 72) throw fail('Password must be no more than 72 UTF-8 bytes.', 400);

    const tokenHash = hashToken(token);
    const passwordHash = await bcrypt.hash(password, 12);
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE account_activation_tokens
       SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash],
    );
    if (!result.rowCount) throw fail('Invalid or expired activation token.', 400);

    const userId = result.rows[0].user_id;
    await client.query(
      'UPDATE users SET password_hash = $1, account_status = $2, updated_at = NOW() WHERE id = $3',
      [passwordHash, 'ACTIVE', userId],
    );

    await audit({
      actorUserId: request.user.id,
      action: 'ACCOUNT_ACTIVATED',
      entityType: 'user',
      entityId: userId,
      ipAddress: clientIp(request),
    }, client);

    await client.query('COMMIT');
    return response.json({ success: true, message: 'Account activated. You can now sign in.' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return requestError(error, response);
  } finally {
    client?.release();
  }
}
