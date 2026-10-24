import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Settings, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { unwrap, userService } from '../../services/api.js';
import Brand from '../ui/Brand.jsx';
import ThemeToggle from '../theme/ThemeToggle.jsx';
import ProfileAvatar from '../ui/ProfileAvatar.jsx';

/**
 * Shared authenticated shell for the member portal, administration, and
 * organization workspaces. `nav` is a permission-aware array of sections:
 *   [{ label, items: [{ label, to, icon, end }] }]
 * `title` and `homePath` customise branding per workspace.
 */
export default function DashboardLayout({
  nav = [],
  title = 'Portal',
  homePath = '/me',
  quickActions = [],
  quickActionsLabel = 'Create',
  admin = false,
}) {
  const { user, logout } = useAuth();
  const { isEthiopian, toggleCalendar } = useSettings();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches);
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState(() => new Set(nav
      .filter((group) => group.items.some((item) => item.to === location.pathname || item.children?.some((child) => child.to === location.pathname)))
      .map((group) => group.label)));
  const [expandedItems, setExpandedItems] = useState(() => new Set(nav.flatMap((group) => group.items
    .filter((item) => item.children?.some((child) => child.to === location.pathname))
    .map((item) => `${group.label}:${item.label}`))));

  const personalNotifications = useAsync(async () => {
    const response = await userService.notifications();
    return {
      items: unwrap(response) ?? [],
      unreadCount: response.data?.meta?.unreadCount,
    };
  }, [user?.id]);
  const unreadNotifications = Number.isFinite(Number(personalNotifications.data?.unreadCount))
    ? Number(personalNotifications.data.unreadCount)
    : (personalNotifications.data?.items ?? []).filter((item) => !item.readAt && !item.isRead && item.status !== 'READ').length;
  const reloadNotifications = personalNotifications.reload;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 980px)');
    const update = () => setIsNarrow(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const refresh = () => reloadNotifications();
    window.addEventListener('church:notifications-updated', refresh);
    return () => window.removeEventListener('church:notifications-updated', refresh);
  }, [reloadNotifications]);

  function toggleSidebar() {
    if (admin && !isNarrow) {
      setCollapsed((value) => !value);
      return;
    }
    setOpen((value) => !value);
  }

  return (
    <div className={`dash-shell${admin ? ' admin-shell' : ''}${collapsed && admin ? ' sidebar-collapsed' : ''}`}>
      <aside className={`dash-sidebar ${open ? 'open' : ''}${collapsed && admin ? ' is-collapsed' : ''}`} aria-label={`${title} navigation`}>
        <Brand to={homePath} subtitle={admin ? 'Administration' : undefined} />
        <nav className="side-nav">
          {nav.map((group) => (
            <NavSection
              key={group.label}
              group={group}
              collapsed={collapsed && admin}
              expanded={expandedSections.has(group.label)}
              expandedItems={expandedItems}
              unreadNotifications={unreadNotifications}
              onToggle={() => setExpandedSections((current) => toggleSet(current, group.label))}
              onToggleItem={(itemLabel) => setExpandedItems((current) => toggleSet(current, `${group.label}:${itemLabel}`))}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="side-link" onClick={logout} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}>
            <LogOut aria-hidden="true" />
            <span className="side-link-label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className={`sidebar-scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="dash-main">
        <header className="dash-header">
          <div className="row dash-header-left">
            <button
              type="button"
              className={`dash-sidebar-toggle${admin ? ' is-admin-toggle' : ''}`}
              aria-label={admin
                ? isNarrow ? open ? 'Close navigation' : 'Open navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'
                : open ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isNarrow ? open : admin ? !collapsed : open}
              onClick={toggleSidebar}
            >
              {open ? <X size={20} /> : admin && !isNarrow
                ? collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />
                : <Menu size={20} />}
            </button>
            <div className="dash-breadcrumbs" aria-label="Breadcrumb">
              <strong style={{ fontFamily: 'var(--font-display)' }}>{title}</strong>
              {location.pathname !== homePath ? <><span aria-hidden="true">/</span><span>{nav.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])])).find((item) => item.to === location.pathname)?.label || 'Workspace'}</span></> : null}
            </div>
          </div>
          <div className="dash-header-actions">
            {quickActions.length ? <div className="dash-quick-create">
              <button type="button" className="dash-quick-create-trigger" aria-expanded={quickCreateOpen} onClick={() => setQuickCreateOpen((value) => !value)}><Plus size={16} /> {quickActionsLabel}</button>
              {quickCreateOpen ? <div className="dash-quick-create-menu" role="menu">
                {quickActions.map((action) => <Link key={action.to} role="menuitem" to={action.to} onClick={() => setQuickCreateOpen(false)}>{action.label}</Link>)}
              </div> : null}
            </div> : null}
            {admin ? <Link to="/me/notifications" className="dash-notification-link dash-notification-bell" aria-label={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'} title="Notifications">
              <Bell size={18} />{unreadNotifications ? <span className="notification-count">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span> : null}
            </Link> : <button type="button" className="dash-calendar-toggle" onClick={toggleCalendar} title="Switch calendar" aria-label={isEthiopian ? 'Switch to Gregorian calendar' : 'Switch to Ethiopian calendar'}>
              <CalendarDays size={16} /><span>{isEthiopian ? 'Ethiopian' : 'Gregorian'}</span>
            </button>}
            <ThemeToggle />
            <div className="dash-profile-menu">
            <button type="button" className="row dash-profile-link" style={{ gap: '0.6rem' }} aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}>
              <span style={{ textAlign: 'right', lineHeight: 1.1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem' }}>{user?.name || 'Member'}</span>
                <span className="muted" style={{ fontSize: '0.78rem' }}>{user?.role ?? ''}</span>
              </span>
              <ProfileAvatar
                src={user?.profileImageUrl || user?.avatarUrl}
                name={user?.name}
                alt={`${user?.name || 'Member'} profile picture`}
                imageClassName="brand-mark"
                fallbackClassName="brand-mark"
                style={{ width: '2.3rem', height: '2.3rem', fontSize: '0.9rem', objectFit: 'cover' }}
              />
            </button>
            {profileOpen ? <div className="dash-profile-dropdown" role="menu">
              <Link to="/me/profile" role="menuitem" onClick={() => setProfileOpen(false)}><UserRound size={15} /> My Profile</Link>
              <Link to="/me/account" role="menuitem" onClick={() => setProfileOpen(false)}><Settings size={15} /> Account Settings</Link>
              <Link to="/me" role="menuitem" onClick={() => setProfileOpen(false)}>Member area</Link>
              <button type="button" role="menuitem" onClick={logout}><LogOut size={15} /> Sign out</button>
            </div> : null}
            </div>
          </div>
        </header>
        <div className="dash-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function toggleSet(current, key) {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function NavSection({ group, collapsed, expanded, expandedItems, unreadNotifications, onToggle, onToggleItem, onNavigate }) {
  if (group.label === 'Dashboard') {
    const item = group.items[0];
    const Icon = item?.icon;
    return item ? <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
      {Icon ? <Icon aria-hidden="true" /> : null}<span className="side-link-label">{item.label}</span>
    </NavLink> : null;
  }

  return (
    <section className="side-nav-group">
      <button type="button" className="nav-section nav-section-toggle" aria-expanded={expanded} onClick={onToggle}>
        <span className="nav-section-label">{group.label}</span><ChevronDown size={14} className={expanded ? 'is-expanded' : ''} aria-hidden="true" />
      </button>
      {expanded ? <div className="side-nav-group-items">{group.items.map((item) => {
        const Icon = item.icon;
        const itemKey = `${group.label}:${item.label}`;
        const showUnread = item.to === '/me/notifications' && unreadNotifications > 0;
        if (item.children?.length) {
          const itemExpanded = expandedItems.has(itemKey);
          return <div className="side-nav-nested" key={item.label}>
            <button type="button" className="side-link side-link-parent" aria-expanded={itemExpanded} onClick={() => onToggleItem(item.label)}>
            {Icon ? <Icon aria-hidden="true" /> : null}<span className="side-link-label">{item.label}</span><ChevronDown size={13} className={itemExpanded ? 'is-expanded' : ''} aria-hidden="true" />
            </button>
            {itemExpanded ? <div className="side-nav-children">{item.children.map((child) => {
              const ChildIcon = child.icon;
              return <NavLink key={child.to} to={child.to} end={child.end} onClick={onNavigate} title={collapsed ? child.label : undefined} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
                {ChildIcon ? <ChildIcon aria-hidden="true" /> : null}<span className="side-link-label">{child.label}</span>
              </NavLink>;
            })}</div> : null}
          </div>;
        }
        return <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? item.label : undefined} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
          {Icon ? <Icon aria-hidden="true" /> : null}<span className="side-link-label">{item.label}</span>
          {showUnread ? <span className="notification-count" style={{ position: 'static', marginLeft: 'auto', border: 0 }}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span> : null}
        </NavLink>;
      })}</div> : null}
    </section>
  );
}
