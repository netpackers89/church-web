import { useLocation, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CalendarDays, Settings } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout.jsx';

export default function GroupManagementLayout() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const base = pathname.includes('/departments/') ? `/departments/${id}/workspace` : `/bible-study/groups/${id}/workspace`;
  const nav = [{ label: 'Group management', items: [
    { label: 'Overview', to: base, icon: LayoutDashboard, end: true },
    { label: 'Members & followers', to: `${base}/members`, icon: Users },
    { label: 'Posts', to: `${base}/posts`, icon: FileText },
    { label: 'Programs', to: `${base}/programs`, icon: CalendarDays },
    { label: 'Settings', to: `${base}/settings`, icon: Settings },
  ] }];
  return <DashboardLayout nav={nav} title="Group workspace" homePath={base} />;
}
