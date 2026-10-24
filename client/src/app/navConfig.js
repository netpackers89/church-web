import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Landmark,
  Bell,
  MessageCircle,
  ShieldCheck,
  KeyRound,
  UserCog,
  User,
  ScrollText,
  Building2,
  Settings,
} from "lucide-react";

/* Permission-aware navigation configs. Each layout filters these by role so a
   single config serves all authenticated workspaces. */

export const memberNav = [
  {
    label: "Overview",
    items: [
      { label: "Community", to: "/community", icon: Users, end: true },
      { label: "Notifications", to: "/me/notifications", icon: Bell },
    ],
  },
  {
    label: "My Church",
    items: [
      { label: "My Calendar", to: "/me/calendar", icon: CalendarClock },
      { label: "My Events", to: "/me/events", icon: CalendarDays },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "My Profile", to: "/me/profile", icon: User, end: true },
      { label: "Edit Profile", to: "/me/profile/edit", icon: UserCog },
      { label: "Account & Password", to: "/me/account", icon: KeyRound },
    ],
  },
];

/* Sidebar entries are management destinations. Creation stays in the global
 * Register menu in the admin header. Child links retain existing tools. */
export function adminNav(permissionSource) {
  const permissions = Array.isArray(permissionSource)
    ? permissionSource
    : Array.isArray(permissionSource?.permissions)
      ? permissionSource.permissions
      : [];
  const granted = new Set(permissions);
  const has = (code) => granted.has(code);
  const items = [
    { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  ];
  if (has("users.read"))
    items.push({ label: "Members", to: "/admin/members", icon: Users });
  if (has("staff.manage"))
    items.push({
      label: "Departments",
      to: "/admin/departments",
      icon: Building2,
    });
  if (has("programs.manage"))
    items.push({
      label: "Bible Study",
      to: "/admin/bible-study",
      icon: BookOpen,
    });
  if (has("telegram.manage"))
    items.push({
      label: "Telegram Management",
      to: "/admin/telegram",
      icon: MessageCircle,
      children: [
        { label: "Overview", to: "/admin/telegram", icon: LayoutDashboard, end: true },
        { label: "Menu builder", to: "/admin/telegram/menu", icon: MessageCircle },
        { label: "Auto-reply rules", to: "/admin/telegram/auto-replies", icon: Bell },
        { label: "Inbox", to: "/admin/telegram-inbox", icon: MessageCircle },
      ],
    });
  if (
    has("programs.manage") ||
    has("events.manage") ||
    has("announcements.manage")
  )
    items.push({
      label: "Programs & Events",
      to: "/admin/programs",
      icon: CalendarDays,
    });
  if (has("finance.manage") || has("reports.read") || has("settings.manage"))
    items.push({ label: "Finance", to: "/admin/finance", icon: Landmark });
  if (has("roles.manage"))
    items.push({
      label: "Roles & Permissions",
      to: "/admin/roles",
      icon: ShieldCheck,
    });
  if (has("settings.manage"))
    items.push({
      label: "Settings",
      to: "/admin/settings",
      icon: Settings,
      children: [
        ...(has("audit.read")
          ? [{ label: "Audit records", to: "/admin/audit", icon: ScrollText }]
          : []),
        ...(has("bible.publish")
          ? [{ label: "Bible verses", to: "/admin/verse", icon: BookOpen }]
          : []),
      ],
    });
  return [{ label: "WORKSPACE", items }];
}
