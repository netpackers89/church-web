import { expandPermissionAliases } from '../services/permissionCatalog.js';

function hasGlobalManagementAuthority(user) {
	const roles = new Set((user?.roles ?? []).map((role) => String(role).toUpperCase()));
	if (['SYSTEM_OWNER', 'ADMIN', 'PASTOR'].some((role) => roles.has(role))) return true;
	const permissions = new Set(user?.permissions ?? []);
	return ['system.owner.manage', 'roles.manage', 'staff.manage', 'users.manage', 'finance.manage', 'settings.manage', 'audit.read']
		.some((permission) => permissions.has(permission));
}

export function requirePermission(...permissions) {
	return (request, response, next) => {
		if (request.user?.hasManagedScope && !hasGlobalManagementAuthority(request.user)) {
			return response.status(403).json({ error: 'This account is limited to its assigned group workspace.' });
		}
		const granted = new Set(expandPermissionAliases(request.user?.permissions ?? []));
		if (!permissions.some((permission) => granted.has(permission))) {
			return response.status(403).json({ error: 'You do not have permission to perform this action.' });
		}
		return next();
	};
}
