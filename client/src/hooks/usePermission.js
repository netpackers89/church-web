import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Frontend permission helpers derived from the user's role.
 *
 * IMPORTANT: These only drive UI visibility. The server is the authoritative
 * source for authorization — every action is re-validated server-side.
 */
export const BROAD_MANAGEMENT_ROLES = ['ADMIN', 'PASTOR'];
const EMPTY_PERMISSIONS = Object.freeze([]);

export function isAdminRole(role) {
  return role === 'ADMIN';
}

export function isBroadManagement(role) {
  return BROAD_MANAGEMENT_ROLES.includes(role);
}

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  const permissions = Array.isArray(user?.permissions) ? user.permissions : EMPTY_PERMISSIONS;

  return useMemo(() => {
    const granted = new Set(permissions ?? []);
    // The API returns effective permissions with the session identity. Roles
    // are kept only as a backwards-compatible display label.
    const can = (permission) => granted.has(permission);
    const isAdmin = can('roles.manage');
    const broad = can('events.manage') || can('announcements.manage');

    return {
      role,
      isAdmin,
      isBroadManagement: broad,
      canManageUsers: can('users.read') || can('users.manage'),
      canManageMembership: can('membership.manage'),
      canManageTelegram: can('telegram.manage'),
      canManageAnnouncements: can('announcements.manage'),
      canManageRoles: can('roles.manage'),
      canManageContent: broad || can('programs.manage') || can('bible.publish'),
      canManageFinance: can('finance.manage'),
      canViewAudit: can('audit.read'),
      canManageSettings: can('settings.manage'),
      canManageRegistrations: can('users.create'),
      canManageTemplates: can('announcements.manage'),
      canViewOwnProfile: true,
      canViewGroups: can('departments.view') || can('bible_study_groups.view'),
      canManageGroups: can('departments.create') || can('bible_study_groups.create'),
      canViewCampaigns: can('fundraising_campaigns.view'),
      canViewTests: can('notifications.test'),
      has: (permission) => granted.has(permission),
      permissions: [...granted],
    };
  }, [role, permissions]);
}

/** Simple predicate for route guards. */
export function hasRole(user, roles) {
  return roles.includes(user?.role);
}

export default usePermissions;

