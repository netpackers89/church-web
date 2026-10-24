import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  ArrowUpRight,
  ChevronDown,
  UserRound,
  Settings,
  Building2,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import Brand from "../ui/Brand.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canAccessAdminArea } from "../../app/authNavigation.js";
import AccountDrawer from "../account/AccountDrawer.jsx";
import ProfileAvatar from "../ui/ProfileAvatar.jsx";
import ThemeToggle from "../theme/ThemeToggle.jsx";
import "./PublicNavbar.css";

const PUBLIC_NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Programs", to: "/programs" },
  { label: "Give", to: "/give" },
  { label: "Departments", to: "/community" },
];
const MEMBER_NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Programs", to: "/programs" },
  { label: "Give", to: "/give" },
  { label: "Departments", to: "/community" },
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 30);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState("profile");
  const [accountInstance, setAccountInstance] = useState(0);
  const [logoutError, setLogoutError] = useState("");
  const profileRef = useRef(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navItems = user ? MEMBER_NAV_ITEMS : PUBLIC_NAV_ITEMS;
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Member";
  const canOpenAdmin = canAccessAdminArea(user);

  const closeMenu = () => setOpen(false);
  const closeAccount = useCallback(() => setAccountOpen(false), []);

  function openAccount(tab) {
    setAccountTab(tab);
    setAccountInstance((instance) => instance + 1);
    setAccountOpen(true);
    setProfileOpen(false);
    setOpen(false);
  }

  useEffect(() => {
    function updateScrolledState() {
      setScrolled(window.scrollY > 30);
    }
    window.addEventListener("scroll", updateScrolledState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolledState);
  }, []);

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
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  async function signOut() {
    setLogoutError("");
    try {
      await logout();
      setProfileOpen(false);
      setOpen(false);
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(error.message || "Could not sign out. Please try again.");
    }
  }

  return (
    <header className={`floating-header-wrapper${scrolled ? " is-scrolled" : ""}`}>
      <div className="floating-header-inner">
        <div className="modern-brand">
          <Brand to="/" />
        </div>

        <nav className="modern-nav-capsule" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `modern-nav-link${isActive ? " is-active" : ""}`
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
                className={`member-profile-trigger${profileOpen ? " is-open" : ""}`}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label={`Member menu for ${firstName}`}
                onClick={() => setProfileOpen((value) => !value)}
              >
                <ProfileAvatar
                  src={user.profileImageUrl || user.avatarUrl}
                  name={user.name}
                  alt={`${user.name || "Member"} profile picture`}
                  imageClassName="member-avatar"
                  fallbackClassName="member-avatar member-avatar-fallback"
                />
                <span className="member-profile-name">{firstName}</span>
                <ChevronDown size={14} className="chevron-icon" aria-hidden="true" />
              </button>
              {profileOpen ? (
                <div
                  className="member-profile-menu"
                  role="menu"
                  aria-label="Member profile menu"
                >
                  <div className="member-profile-summary">
                    <ProfileAvatar
                      src={user.profileImageUrl || user.avatarUrl}
                      name={user.name}
                      alt={`${user.name || "Member"} profile picture`}
                      imageClassName="member-avatar"
                      fallbackClassName="member-avatar member-avatar-fallback"
                    />
                    <div className="member-info">
                      <strong>{firstName}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                  <div className="menu-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openAccount("profile")}
                  >
                    <UserRound size={16} />
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openAccount("security")}
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  <Link
                    to="/community"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Building2 size={16} />
                    Find Community Groups
                  </Link>
                  {(user.managedDepartments?.length || user.managedBibleStudyGroups?.length) ? (
                    <Link
                      to="/me/manage-groups"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Building2 size={16} />
                      Manage My Groups
                    </Link>
                  ) : null}
                  {canOpenAdmin ? (
                    <Link
                      to="/admin"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                    >
                      <LayoutDashboard size={16} />
                      Admin Dashboard
                    </Link>
                  ) : null}
                  <div className="menu-divider" />
                  {logoutError ? (
                    <p className="member-logout-error" role="alert">
                      {logoutError}
                    </p>
                  ) : null}
                  <button
                    className="member-profile-logout"
                    type="button"
                    role="menuitem"
                    onClick={signOut}
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link to="/login" className="modern-login-link">
              Sign in <ArrowUpRight size={14} />
            </Link>
          )}

          <ThemeToggle />

          <Link to="/give" className="modern-join-button">
            Give <ArrowUpRight size={15} />
          </Link>

          <button
            type="button"
            className="modern-menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="modern-mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
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
              end={item.to === "/"}
              className={({ isActive }) =>
                `modern-mobile-link${isActive ? " is-active" : ""}`
              }
              onClick={closeMenu}
            >
              {item.label}
              <ArrowUpRight size={16} />
            </NavLink>
          ))}
          {user ? (
            <div className="modern-mobile-member-menu">
              {(user.managedDepartments?.length || user.managedBibleStudyGroups?.length) ? (
                <Link to="/me/manage-groups" onClick={closeMenu}>
                  <Building2 size={16} /> Manage My Groups
                </Link>
              ) : null}
              <button type="button" onClick={() => openAccount("security")}>
                <Settings size={16} /> Settings
              </button>
              <button type="button" className="member-profile-logout" onClick={signOut}>
                <LogOut size={16} /> Log out
              </button>
            </div>
          ) : (
            <div className="mobile-actions-group">
              <Link to="/login" className="modern-mobile-login" onClick={closeMenu}>Sign in</Link>
            </div>
          )}
        </nav>
      )}
      <AccountDrawer
        key={accountInstance}
        open={accountOpen}
        onClose={closeAccount}
        initialTab={accountTab}
      />
    </header>
  );
}