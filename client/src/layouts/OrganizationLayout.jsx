import { LayoutDashboard, Users, CalendarDays, Megaphone, Building2 } from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout.jsx';

/**
 * Organization workspace shell (Youth / Fellowship leaders and coordinators).
 * Scoped navigation only — leaders never see sibling-organization data because
 * routes are guarded server-side and the nav is intentionally narrow.
 */
const orgNav = [
  {
    label: 'Organization',
    items: [
      { label: 'Overview', to: '.', icon: LayoutDashboard, end: true },
      { label: 'Departments', to: 'departments', icon: Building2 },
      { label: 'Members', to: 'members', icon: Users },
      { label: 'Events', to: 'events', icon: CalendarDays },
      { label: 'Announcements', to: 'announcements', icon: Megaphone },
    ],
  },
];

export default function OrganizationLayout() {
  return <DashboardLayout nav={orgNav} title="Organization" homePath="/organizations" />;
}

