import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { config } from '../config/env.js';
import { expandPermissionAliases } from '../services/permissionCatalog.js';

function readCookie(request, name) {
	const cookieHeader = request.headers.cookie ?? '';
	const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
	return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

export async function requireUser(request, response, next) {
	if (!config.jwtSecret || config.jwtSecret.length < 32) {
		return response.status(503).json({ error: 'Authentication requires a JWT_SECRET of at least 32 characters in server/.env.' });
	}
	const token = readCookie(request, 'church_session')
		?? request.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) return response.status(401).json({ error: 'Sign in to continue.' });

	try {
		const payload = jwt.verify(token, config.jwtSecret, { issuer: 'church-management-api' });
		const user = await pool.query(
			`SELECT u.account_status, u.session_version, u.role,
				COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), ARRAY[]::VARCHAR[]) AS roles,
				COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), ARRAY[]::VARCHAR[]) AS permissions,
				(EXISTS (
					SELECT 1 FROM departments d LEFT JOIN department_members dm ON dm.department_id=d.id
					WHERE (d.leader_user_id=u.id OR (dm.user_id=u.id AND UPPER(dm.role) IN ('LEADER','MANAGER')))
					AND d.is_active=TRUE AND d.deleted_at IS NULL
				) OR EXISTS (
					SELECT 1 FROM bible_study_groups g LEFT JOIN bible_study_memberships bm ON bm.bible_study_group_id=g.id
					WHERE (g.leader_user_id=u.id OR (bm.user_id=u.id AND UPPER(bm.role) IN ('LEADER','MANAGER')))
					AND g.is_active=TRUE AND g.deleted_at IS NULL
				)) AS has_managed_scope
			 FROM users u
			 LEFT JOIN user_roles ur ON ur.user_id = u.id
			 LEFT JOIN roles r ON r.id = ur.role_id
			 LEFT JOIN role_permissions rp ON rp.role_id = r.id
			 LEFT JOIN permissions p ON p.id = rp.permission_id
			 WHERE u.id = $1
			 GROUP BY u.id`,
			[payload.sub],
		);
		if (!user.rowCount || user.rows[0].account_status !== 'ACTIVE' || user.rows[0].session_version !== payload.sessionVersion) {
			return response.status(401).json({ error: 'Your session is no longer active. Please sign in again.' });
		}
		const identity = user.rows[0];
		request.user = {
			id: String(payload.sub),
			role: identity.role,
			roles: identity.roles.length ? identity.roles : [identity.role],
			permissions: expandPermissionAliases(identity.permissions),
			hasManagedScope: identity.has_managed_scope,
		};
		return next();
	} catch (error) {
		if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
			console.error('[auth] session validation failed:', error.message);
			return response.status(503).json({ error: 'The account service is temporarily unavailable.' });
		}
		return response.status(401).json({ error: 'Your session is invalid or has expired. Please sign in again.' });
	}
}
