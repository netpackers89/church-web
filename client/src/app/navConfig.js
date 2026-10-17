import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarClock,
  CalendarDays,
  HandHeart,
  Landmark,
  BarChart3,
  Bell,
  ShieldCheck,
  KeyRound,
  UserCog,
  User,
  MessageCircle,
  Mail as MailTemplateIcon,
  ScrollText,
  Building2,
  UserRoundPlus,
  Megaphone,
} from 'lucide-react';

/* Permission-aware navigation configs. Each layout filters these by role so a
   single config serves all authenticated workspaces. */

export const memberNav = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', to: '/me', icon: LayoutDashboard, end: true },
      { label: 'Notifications', to: '/me/notifications', icon: Bell },
    ],
  },
  {
    label: 'My Church',
    items: [
      { label: 'My Calendar', to: '/me/calendar', icon: CalendarClock },
      { label: 'My Events', to: '/me/events', icon: CalendarDays },
      { label: 'Bible Study', to: '/me/bible-study', icon: BookOpen },
      { label: 'Organizations', to: '/me/organizations', icon: Users },
      { label: 'My Giving', to: '/me/giving', icon: HandHeart },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My Profile', to: '/me/profile', icon: User, end: true },
      { label: 'Edit Profile', to: '/me/profile/edit', icon: UserCog },
      { label: 'Account & Password', to: '/me/account', icon: KeyRound },
    ],
  },
];

export function adminNav(permissionSource) {
  const permissions = Array.isArray(permissionSource)
    ? permissionSource
    : Array.isArray(permissionSource?.permissions)
      ? permissionSource.permissions
      : [];
  const granted = new Set(permissions);
  const has = (code) => granted.has(code);

  const sections = [{ label: 'Dashboard', items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true }] }];

  /* ---------- Members ---------- */
  const members = [];
  if (has('users.read')) members.push({ label: 'Members & Staff', to: '/admin/members', icon: Users });
  if (has('membership.manage')) members.push({ label: 'New Believers & Discipleship', to: '/admin/new-christians', icon: UserRoundPlus });
  if (members.length) sections.push({ label: 'Members', items: members });

  /* ---------- Programs ---------- */
  const programs = [];
  if (has('events.manage')) programs.push({ label: 'Events & Gatherings', to: '/admin/events', icon: CalendarDays });
  if (has('programs.manage')) programs.push({ label: 'Regular Programs', to: '/admin/program-library', icon: CalendarDays });
  if (has('fundraising_campaigns.view')) programs.push({ label: 'Campaigns & Fundraising', to: '/admin/campaigns', icon: HandHeart });
  if (has('staff.manage')) programs.push({ label: 'Departments & Organizations', to: '/admin/departments', icon: Building2 });
  if (has('programs.manage')) programs.push({ label: 'Bible Study Groups', to: '/admin/bible-study', icon: BookOpen });
  if (has('bible.publish')) programs.push({ label: 'Daily Bible Verses', to: '/admin/verse', icon: BookOpen });
  if (programs.length) sections.push({ label: 'Programs', items: programs });

  /* ---------- Communications ---------- */
  const communications = [];
  if (has('announcements.manage')) communications.push({ label: 'Announcements', to: '/admin/announcements', icon: Megaphone });
  if (has('announcements.manage')) communications.push({ label: 'Email & Templates', to: '/admin/message-templates', icon: MailTemplateIcon });
  if (has('telegram.manage')) communications.push({ label: 'Telegram Bot & Inbox', to: '/admin/telegram-inbox', icon: MessageCircle });
  if (has('notifications.manage') || has('announcements.manage')) communications.push({ label: 'Website Notifications', to: '/admin/notifications', icon: Bell });
  if (has('notifications.test')) communications.push({ label: 'Communication Testing', to: '/admin/communications-test', icon: ScrollText });
  if (communications.length) sections.push({ label: 'Communications', items: communications });

  /* ---------- Finance ---------- */
  const finance = [];
  if (has('finance.manage')) finance.push({ label: 'Giving & Contributions', to: '/admin/giving', icon: Landmark });
  if (has('reports.read') || has('finance.manage')) finance.push({ label: 'Reports', to: '/admin/reports', icon: BarChart3 });
  if (finance.length) sections.push({ label: 'Finance', items: finance });

  /* ---------- System ---------- */
  const system = [];
  if (has('audit.read')) system.push({ label: 'Audit Logs', to: '/admin/audit', icon: ScrollText });
  if (has('roles.manage')) system.push({ label: 'Roles & Permissions', to: '/admin/roles', icon: ShieldCheck });
  if (has('settings.manage')) system.push({ label: 'Settings', to: '/admin/settings', icon: KeyRound });
  if (system.length) sections.push({ label: 'System', items: system });

  return sections;
}
