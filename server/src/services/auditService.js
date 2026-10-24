import { pool } from '../config/db.js';

export async function audit({ actorUserId = null, action, entityType, entityId = null, before = null, after = null, ipAddress = null }, queryable = pool) {
	await queryable.query(
		`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, before_data, after_data, ip_address)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		[actorUserId, action, entityType, entityId === null ? null : String(entityId), before, after, ipAddress],
	);
}

export function clientIp(request) {
	return request.ip || request.socket?.remoteAddress || null;
}
