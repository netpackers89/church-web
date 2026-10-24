import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import { adminNav } from '../app/navConfig.js';
import { usePermissions } from '../hooks/usePermission.js';

/** Administration shell. Navigation is filtered by the current user's role. */
export default function AdminLayout() {
  const perms = usePermissions();
  const quickActions = [
    ...(perms.has('membership.manage') ? [{ label: 'Register New Christian', to: '/new-christian' }] : []),
    ...(perms.has('users.create') && perms.has('roles.manage') ? [{ label: 'Register Staff', to: '/admin/registrations?type=staff' }] : []),
    ...(perms.has('staff.manage') ? [{ label: 'Register Department', to: '/admin/registrations?type=department' }] : []),
    ...(perms.has('programs.manage') ? [{ label: 'Register Bible Study Group', to: '/admin/registrations?type=bible-study-group' }] : []),
  ];
  return (
    <DashboardLayout
      nav={adminNav(perms)}
      title="Administration"
      homePath="/admin"
      quickActions={quickActions}
      quickActionsLabel="Register"
      expandAllNav
      admin
    />
  );
}
