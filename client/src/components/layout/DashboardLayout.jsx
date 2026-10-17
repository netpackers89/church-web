import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, LogOut, CalendarDays, X, Plus, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import Brand from '../ui/Brand.jsx';

/**
 * Shared authenticated shell for the member portal, administration, and
 * organization workspaces. `nav` is a permission-aware array of sections:
 *   [{ label, items: [{ label, to, icon, end }] }]
 * `title` and `homePath` customise branding per workspace.
 */
export default function DashboardLayout({ nav = [], title = 'Portal', homePath = '/me', quickActions = [] }) {
  const { user, logout } = useAuth();
  const { isEthiopian, toggleCalendar } = useSettings();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState(() => new Set(nav
    .filter((group) => group.items.some((item) => item.to === location.pathname || item.children?.some((child) => child.to === location.pathname)))
    .map((group) => group.label)));
  const [expandedItems, setExpandedItems] = useState(() => new Set(nav.flatMap((group) => group.items
    .filter((item) => item.children?.some((child) => child.to === location.pathname))
    .map((item) => `${group.label}:${item.label}`))));

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="dash-shell">
      <aside className={`dash-sidebar ${open ? 'open' : ''}`} aria-label={`${title} navigation`}>
        <Brand to={homePath} />
        <nav className="side-nav">
          {nav.map((group) => (
            <NavSection
              key={group.label}
              group={group}
              expanded={expandedSections.has(group.label)}
              expandedItems={expandedItems}
              onToggle={() => setExpandedSections((current) => toggleSet(current, group.label))}
              onToggleItem={(itemLabel) => setExpandedItems((current) => toggleSet(current, `${group.label}:${itemLabel}`))}
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="side-link" onClick={logout} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}>
            <LogOut aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <div className={`sidebar-scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="dash-main">
        <header className="dash-header">
          <div className="row dash-header-left">
            <button type="button" className="dash-sidebar-toggle" aria-label="Toggle navigation" onClick={() => setOpen((o) => !o)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="dash-breadcrumbs" aria-label="Breadcrumb">
              <strong style={{ fontFamily: 'var(--font-display)' }}>{title}</strong>
              {location.pathname !== homePath ? <><span aria-hidden="true">/</span><span>{nav.flatMap((group) => group.items.flatMap((item) => [item, ...(item.children ?? [])])).find((item) => item.to === location.pathname)?.label || 'Workspace'}</span></> : null}
            </div>
          </div>
          <div className="dash-header-actions">
            <button type="button" className="dash-calendar-toggle" onClick={toggleCalendar} title="Switch calendar" aria-label={isEthiopian ? 'Switch to Gregorian calendar' : 'Switch to Ethiopian calendar'}>
              <CalendarDays size={16} /><span>{isEthiopian ? 'Ethiopian' : 'Gregorian'}</span>
            </button>
            {quickActions.length ? <div className="dash-quick-create">
              <button type="button" className="dash-quick-create-trigger" aria-expanded={quickCreateOpen} onClick={() => setQuickCreateOpen((value) => !value)}><Plus size={16} /> Create</button>
              {quickCreateOpen ? <div className="dash-quick-create-menu" role="menu">
                {quickActions.map((action) => <Link key={action.to} role="menuitem" to={action.to} onClick={() => setQuickCreateOpen(false)}>{action.label}</Link>)}
              </div> : null}
            </div> : null}
            <Link to="/me/profile" className="row dash-profile-link" style={{ gap: '0.6rem' }} aria-label="My profile">
              <span style={{ textAlign: 'right', lineHeight: 1.1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem' }}>{user?.name || 'Member'}</span>
                <span className="muted" style={{ fontSize: '0.78rem' }}>{user?.role ?? ''}</span>
              </span>
              <span className="brand-mark" style={{ width: '2.3rem', height: '2.3rem', fontSize: '0.9rem' }}>{initials}</span>
            </Link>
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

function NavSection({ group, expanded, expandedItems, onToggle, onToggleItem, onNavigate }) {
  if (group.label === 'Dashboard') {
    const item = group.items[0];
    const Icon = item?.icon;
    return item ? <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
      {Icon ? <Icon aria-hidden="true" /> : null}{item.label}
    </NavLink> : null;
  }

  return (
    <section className="side-nav-group">
      <button type="button" className="nav-section nav-section-toggle" aria-expanded={expanded} onClick={onToggle}>
        <span>{group.label}</span><ChevronDown size={14} className={expanded ? 'is-expanded' : ''} aria-hidden="true" />
      </button>
      {expanded ? <div className="side-nav-group-items">{group.items.map((item) => {
        const Icon = item.icon;
        const itemKey = `${group.label}:${item.label}`;
        if (item.children?.length) {
          const itemExpanded = expandedItems.has(itemKey);
          return <div className="side-nav-nested" key={item.label}>
            <button type="button" className="side-link side-link-parent" aria-expanded={itemExpanded} onClick={() => onToggleItem(item.label)}>
              {Icon ? <Icon aria-hidden="true" /> : null}<span>{item.label}</span><ChevronDown size={13} className={itemExpanded ? 'is-expanded' : ''} aria-hidden="true" />
            </button>
            {itemExpanded ? <div className="side-nav-children">{item.children.map((child) => {
              const ChildIcon = child.icon;
              return <NavLink key={child.to} to={child.to} end={child.end} onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
                {ChildIcon ? <ChildIcon aria-hidden="true" /> : null}{child.label}
              </NavLink>;
            })}</div> : null}
          </div>;
        }
        return <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
          {Icon ? <Icon aria-hidden="true" /> : null}{item.label}
        </NavLink>;
      })}</div> : null}
    </section>
  );
}
