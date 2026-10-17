import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowUpRight, ChevronDown, UserRound, Settings, Building2, BookOpen, LayoutDashboard, LogOut } from 'lucide-react';
import Brand from '../ui/Brand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { canAccessAdminArea } from '../../app/authNavigation.js';
import MemberSettingsDialog from './MemberSettingsDialog.jsx';

const PUBLIC_NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Programs', to: '/programs' },
  { label: 'New Creation', to: '/new-christian' },
  { label: 'About', to: '/about' },
  { label: 'Give', to: '/give' },
];
const MEMBER_NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Programs', to: '/programs' },
  { label: 'Giving', to: '/give' },
  { label: 'About', to: '/about' },
  { label: 'Departments', to: '/me/organizations' },
  { label: 'Bible Studies', to: '/me/bible-study' },
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const profileRef = useRef(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navItems = user ? MEMBER_NAV_ITEMS : PUBLIC_NAV_ITEMS;
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Member';
  const initials = (user?.name || 'Member').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const canOpenAdmin = canAccessAdminArea(user);

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    function onPointerDown(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  async function signOut() {
    setLogoutError('');
    try {
      await logout();
      setProfileOpen(false);
      setOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      setLogoutError(error.message || 'Could not sign out. Please try again.');
    }
  }

  return (
    <header className={`modern-header${open ? ' is-open' : ''}`}>
      <div className="modern-header-inner">
        <div className="modern-brand">
          <Brand to="/" />
        </div>

        <nav className="modern-nav" aria-label="Main navigation">
            {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `modern-nav-link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="modern-header-actions">
          {user ? (
            <div className="member-profile-control" ref={profileRef}>
              <button
                type="button"
                className={`member-profile-trigger${profileOpen ? ' is-open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label={`Member menu for ${firstName}`}
                onClick={() => setProfileOpen((value) => !value)}
              >
                {user.profileImageUrl || user.avatarUrl ? <img className="member-avatar" src={user.profileImageUrl || user.avatarUrl} alt="" /> : <span className="member-avatar member-avatar-fallback">{initials}</span>}
                <span className="member-profile-name">{firstName}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {profileOpen ? (
                <div className="member-profile-menu" role="menu" aria-label="Member profile menu">
                  <div className="member-profile-summary">
                    {user.profileImageUrl || user.avatarUrl ? <img className="member-avatar" src={user.profileImageUrl || user.avatarUrl} alt="" /> : <span className="member-avatar member-avatar-fallback">{initials}</span>}
                    <span><strong>{firstName}</strong><small>{user.email}</small></span>
                  </div>
                  <Link to="/me/profile" role="menuitem" onClick={() => setProfileOpen(false)}><UserRound size={16} />Profile</Link>
                  <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}><Settings size={16} />Settings</button>
                  <Link to="/me/organizations" role="menuitem" onClick={() => setProfileOpen(false)}><Building2 size={16} />My Departments</Link>
                  <Link to="/me/bible-study" role="menuitem" onClick={() => setProfileOpen(false)}><BookOpen size={16} />My Bible Study Groups</Link>
                  {canOpenAdmin ? <Link to="/admin" role="menuitem" onClick={() => setProfileOpen(false)}><LayoutDashboard size={16} />Admin Dashboard</Link> : null}
                  {logoutError ? <p className="member-logout-error" role="alert">{logoutError}</p> : null}
                  <button className="member-profile-logout" type="button" role="menuitem" onClick={signOut}><LogOut size={16} />Log out</button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link to="/login" className="modern-login-link">Sign in <ArrowUpRight size={15} /></Link>
          )}

          {!user ? <Link to="/about#visit" className="modern-join-button">Plan a visit <ArrowUpRight size={16} /></Link> : null}

          <button
            type="button"
            className="modern-menu-toggle"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="modern-mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="modern-mobile-menu"
          className="modern-mobile-menu"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `modern-mobile-link${isActive ? ' is-active' : ''}`
              }
              onClick={closeMenu}
            >
              {item.label}
              <span>↗</span>
            </NavLink>
          ))}

          {user ? (
            <div className="modern-mobile-member-menu">
              <div className="member-profile-summary">
                {user.profileImageUrl || user.avatarUrl ? <img className="member-avatar" src={user.profileImageUrl || user.avatarUrl} alt="" /> : <span className="member-avatar member-avatar-fallback">{initials}</span>}
                <span><strong>{firstName}</strong><small>{user.email}</small></span>
              </div>
              <button type="button" onClick={() => { closeMenu(); setSettingsOpen(true); }}><Settings size={16} />Settings</button>
              <Link to="/me/organizations" onClick={closeMenu}><Building2 size={16} />My Departments</Link>
              <Link to="/me/bible-study" onClick={closeMenu}><BookOpen size={16} />My Bible Study Groups</Link>
              {canOpenAdmin ? <Link to="/admin" onClick={closeMenu}><LayoutDashboard size={16} />Admin Dashboard</Link> : null}
              <button type="button" onClick={signOut}><LogOut size={16} />Log out</button>
              {logoutError ? <p className="member-logout-error" role="alert">{logoutError}</p> : null}
            </div>
          ) : (
            <>
              <Link to="/login" className="modern-mobile-login" onClick={closeMenu}>Sign in to your account</Link>
              <Link to="/about#visit" className="modern-mobile-visit" onClick={closeMenu}>Plan your visit</Link>
              <Link to="/register" className="modern-mobile-join" onClick={closeMenu}>Create an account</Link>
            </>
          )}
        </nav>
      )}
      <MemberSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
