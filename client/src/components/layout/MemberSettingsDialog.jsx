import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Building2, KeyRound, Moon, Sun, UserRound, X, Monitor } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import TelegramIntegrationPanel from './TelegramIntegrationPanel.jsx';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function MemberSettingsDialog({ open, onClose }) {
  const dialogRef = useRef(null);
  const { theme, setTheme } = useSettings();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="member-settings-dialog"
      aria-labelledby="member-settings-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="member-settings-panel">
        <header className="member-settings-header">
          <div>
            <span className="eyebrow blue"><span className="dot" /> Your account</span>
            <h2 id="member-settings-title">Account settings</h2>
          </div>
          <button className="member-settings-close" type="button" onClick={onClose} aria-label="Close account settings">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <section className="member-settings-section" aria-labelledby="member-theme-title">
          <div className="member-settings-section-heading">
            <div className="member-settings-icon"><Sun size={17} aria-hidden="true" /></div>
            <div><h3 id="member-theme-title">Appearance</h3><p>Choose how the site looks on this device.</p></div>
          </div>
          <div className="member-theme-options" role="group" aria-label="Color theme">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={`member-theme-option${theme === value ? ' is-selected' : ''}`}
                aria-pressed={theme === value}
                onClick={() => setTheme(value)}
              >
                <Icon size={16} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </section>

        <section className="member-settings-section" aria-labelledby="member-profile-title">
          <div className="member-settings-section-heading">
            <div className="member-settings-icon"><UserRound size={17} aria-hidden="true" /></div>
            <div><h3 id="member-profile-title">Profile &amp; memberships</h3><p>Manage your details and view your church connections.</p></div>
          </div>
          <nav className="member-settings-links" aria-label="Profile and memberships">
            <Link to="/me/profile/edit" onClick={onClose}><UserRound size={16} aria-hidden="true" />Edit profile</Link>
            <Link to="/community" onClick={onClose}><Building2 size={16} aria-hidden="true" />Find community groups</Link>
          </nav>
        </section>

        <section className="member-settings-section member-settings-security" aria-labelledby="member-security-title">
          <div className="member-settings-section-heading">
            <div className="member-settings-icon"><KeyRound size={17} aria-hidden="true" /></div>
            <div><h3 id="member-security-title">Account security</h3><p>Update your password, email verification, and notification preferences.</p></div>
          </div>
          <Link className="member-settings-action" to="/me/account" onClick={onClose}><Bell size={16} aria-hidden="true" />Security &amp; notifications</Link>
        </section>

        <TelegramIntegrationPanel compact />
      </div>
    </dialog>
  );
}
