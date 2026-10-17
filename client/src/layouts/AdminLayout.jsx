import DashboardLayout from '../components/layout/DashboardLayout.jsx';
import { adminNav } from '../app/navConfig.js';
import { usePermissions } from '../hooks/usePermission.js';

/** Administration shell. Navigation is filtered by the current user's role. */
export default function AdminLayout() {
  const perms = usePermissions();
  const quickActions = [
    ...(perms.has('events.manage') ? [{ label: 'Create event', to: '/admin/events' }] : []),
    ...(perms.has('announcements.manage') ? [{ label: 'Create announcement', to: '/admin/announcements' }] : []),
    ...(perms.has('staff.manage') || perms.has('programs.manage') || (perms.has('users.create') && perms.has('roles.manage')) ? [{ label: 'Registration Center', to: '/admin/registrations' }] : []),
  ];
  return <DashboardLayout nav={adminNav(perms)} title="Administration" homePath="/admin" quickActions={quickActions} />;
}

