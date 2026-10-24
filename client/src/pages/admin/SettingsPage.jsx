import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, ChevronRight, Clock3, Globe2, Image, Landmark, LockKeyhole, Palette, Save, ScrollText, ShieldCheck, UsersRound } from 'lucide-react';
import { adminService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const PROFILE_FIELDS = ['churchName', 'logoUrl', 'faviconUrl', 'contactEmail', 'contactPhone', 'address', 'mapUrl', 'serviceTimes', 'socialFacebook', 'socialInstagram', 'socialYoutube'];
const WEBSITE_FIELDS = ['publicSiteStatus', 'defaultTheme', 'defaultLanguage', 'calendarSystem'];
const EMPTY_PROFILE = Object.freeze({
  churchName: '', logoUrl: '', faviconUrl: '', contactEmail: '', contactPhone: '', address: '', mapUrl: '', serviceTimes: '', socialFacebook: '', socialInstagram: '', socialYoutube: '',
  publicSiteStatus: 'LIVE', defaultTheme: 'SYSTEM', defaultLanguage: 'en', calendarSystem: 'ETHIOPIAN',
});
const sections = [
  { id: 'church', label: 'Church profile', description: 'Identity, contact details and location', icon: Building2 },
  { id: 'access', label: 'Users & access', description: 'Roles, staff access and account rules', icon: UsersRound },
  { id: 'website', label: 'Website & localization', description: 'Public website, language and calendar', icon: Globe2 },
  { id: 'security', label: 'Security & audit', description: 'Activity history and system safeguards', icon: ShieldCheck },
];

function readProfile(settings) {
  return Object.fromEntries(Object.entries(EMPTY_PROFILE).map(([key, fallback]) => [key, typeof settings?.[key] === 'string' ? settings[key] : fallback]));
}

function pick(source, fields) {
  return Object.fromEntries(fields.map((key) => [key, source[key]]));
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const settings = useAsync(async () => {
    const response = await adminService.settings();
    return response?.data?.data ?? response?.data ?? {};
  }, []);
  const [active, setActive] = useState('church');
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!settings.data || typeof settings.data !== 'object') return;
    const next = readProfile(settings.data);
    setProfile(next);
    setSavedProfile(next);
  }, [settings.data]);

  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(savedProfile), [profile, savedProfile]);
  const permissions = new Set(user?.permissions ?? []);
  const can = (permission) => permissions.has(permission);

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const change = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }));
  function leaveProfile(next) {
    if (!dirty || window.confirm('You have unsaved settings. Leave without saving these changes?')) setActive(next);
  }
  async function save(fields) {
    setSaving(true);
    setSaveError('');
    try {
      await adminService.updateSettings(pick(profile, fields));
      setSavedProfile((current) => ({ ...current, ...pick(profile, fields) }));
      success('Settings saved', 'Your church configuration has been updated.');
    } catch (reason) {
      const message = reason?.message || 'Could not save settings.';
      setSaveError(message);
      toastError('Settings not saved', message);
    } finally { setSaving(false); }
  }
  const activeSection = sections.find((section) => section.id === active);

  return <div className="settings-page">
    <header className="settings-page-head">
      <div><span className="eyebrow blue"><ShieldCheck size={15} /> Church administration</span><h1>Settings</h1><p>Manage your church website, people, and platform preferences from one place.</p></div>
      <div className="settings-admin-note"><LockKeyhole size={16} /><span>Changes are permission-controlled and recorded.</span></div>
    </header>
    <DataState query={settings} feature="Church settings" endpoint="/admin/settings" skeletonCount={1} isEmpty={() => false}>
      {() => <div className="settings-workspace">
        <aside className="settings-nav" aria-label="Settings sections">
          {sections.map((section) => {
            const Icon = section.icon;
            const selected = section.id === active;
            return <button key={section.id} type="button" className={`settings-nav-item${selected ? ' active' : ''}`} aria-current={selected ? 'page' : undefined} onClick={() => leaveProfile(section.id)}>
              <span className="settings-nav-icon"><Icon size={18} /></span><span><strong>{section.label}</strong><small>{section.description}</small></span><ChevronRight size={17} aria-hidden="true" />
            </button>;
          })}
        </aside>
        <section className="settings-panel" aria-labelledby="settings-panel-title">
          <div className="settings-panel-heading"><div className="settings-panel-icon">{activeSection && <activeSection.icon size={20} />}</div><div><h2 id="settings-panel-title">{activeSection?.label}</h2><p>{activeSection?.description}</p></div></div>
          {saveError ? <Alert variant="danger">{saveError}</Alert> : null}
          {active === 'church' ? <ChurchProfile profile={profile} change={change} onSave={() => save(PROFILE_FIELDS)} saving={saving} dirty={dirty} /> : null}
          {active === 'access' ? <AccessSettings can={can} confirmLeave={dirty ? () => window.confirm('You have unsaved settings. Continue without saving them?') : null} /> : null}
          {active === 'website' ? <WebsiteSettings profile={profile} change={change} onSave={() => save(WEBSITE_FIELDS)} saving={saving} dirty={dirty} /> : null}
          {active === 'security' ? <SecuritySettings can={can} /> : null}
        </section>
      </div>}
    </DataState>
  </div>;
}

function ChurchProfile({ profile, change, onSave, saving, dirty }) {
  return <form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSave(); }} noValidate>
    <div className="settings-form-intro"><Image size={17} /><span>These details are used in church records and public-facing contact information.</span></div>
    <div className="settings-fields">
      <Input label="Church name" value={profile.churchName} onChange={change('churchName')} placeholder="Enter your church name" required />
      <Input label="Logo URL" type="url" value={profile.logoUrl} onChange={change('logoUrl')} placeholder="https://…/church-logo.png" hint="Use a square, public image URL." />
      <Input label="Public email" type="email" value={profile.contactEmail} onChange={change('contactEmail')} placeholder="info@church.org" />
      <Input label="Phone number" type="tel" value={profile.contactPhone} onChange={change('contactPhone')} placeholder="+251 …" />
      <div className="settings-field-wide"><Input label="Church address" value={profile.address} onChange={change('address')} placeholder="Enter the church location" /></div>
      <Input label="Map link" type="url" value={profile.mapUrl} onChange={change('mapUrl')} placeholder="Google Maps or OpenStreetMap link" />
      <Input label="Service times" value={profile.serviceTimes} onChange={change('serviceTimes')} placeholder="Sunday worship · 9:00 AM" />
      <Input label="Facebook URL" type="url" value={profile.socialFacebook} onChange={change('socialFacebook')} placeholder="https://facebook.com/…" />
      <Input label="Instagram URL" type="url" value={profile.socialInstagram} onChange={change('socialInstagram')} placeholder="https://instagram.com/…" />
      <Input label="YouTube URL" type="url" value={profile.socialYoutube} onChange={change('socialYoutube')} placeholder="https://youtube.com/…" />
    </div><SaveBar dirty={dirty} saving={saving} onCancel={() => window.location.reload()} />
  </form>;
}

function WebsiteSettings({ profile, change, onSave, saving, dirty }) {
  return <form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSave(); }} noValidate>
    <div className="settings-form-intro"><Palette size={17} /><span>Choose the defaults used when new visitors and members first open your website.</span></div>
    <div className="settings-fields">
      <Input label="Public website" type="select" value={profile.publicSiteStatus} onChange={change('publicSiteStatus')} options={[{ value: 'LIVE', label: 'Live and visible' }, { value: 'MAINTENANCE', label: 'Maintenance mode' }]} />
      <Input label="Default appearance" type="select" value={profile.defaultTheme} onChange={change('defaultTheme')} options={[{ value: 'SYSTEM', label: 'Match device' }, { value: 'LIGHT', label: 'Light' }, { value: 'DARK', label: 'Dark' }]} />
      <Input label="Default language" type="select" value={profile.defaultLanguage} onChange={change('defaultLanguage')} options={[{ value: 'en', label: 'English' }, { value: 'am', label: 'Amharic' }]} />
      <Input label="Default calendar" type="select" value={profile.calendarSystem} onChange={change('calendarSystem')} options={[{ value: 'ETHIOPIAN', label: 'Ethiopian calendar' }, { value: 'GREGORIAN', label: 'Gregorian calendar' }]} />
      <Input label="Favicon URL" type="url" value={profile.faviconUrl} onChange={change('faviconUrl')} placeholder="https://…/favicon.png" hint="A small square icon used in browser tabs." />
    </div><SaveBar dirty={dirty} saving={saving} onCancel={() => window.location.reload()} />
  </form>;
}

function AccessSettings({ can, confirmLeave }) {
  return <div className="settings-action-list">
    <ActionRow icon={<UsersRound size={19} />} title="Staff accounts" description="Invite, activate, and manage staff members who can access the church workspace." to="/admin/staff" allowed={can('users.read')} confirmLeave={confirmLeave} />
    <ActionRow icon={<ShieldCheck size={19} />} title="Roles & permissions" description="Define roles and precisely control what each staff member can manage." to="/admin/roles" allowed={can('roles.manage')} confirmLeave={confirmLeave} />
    <ActionRow icon={<Landmark size={19} />} title="Giving accounts" description="Manage verified bank and Telebirr details displayed on the public giving page." to="/admin/finance" allowed={can('finance.manage') || can('settings.manage')} confirmLeave={confirmLeave} />
  </div>;
}

function SecuritySettings({ can }) {
  return <div className="settings-action-list">
    <div className="settings-security-callout"><LockKeyhole size={19} /><div><strong>Secrets stay server-side</strong><p>Email passwords, bot tokens, API keys, and session secrets are never returned to this page.</p></div></div>
    <ActionRow icon={<ScrollText size={19} />} title="Audit history" description="Review sensitive changes, including configuration updates and account administration." to="/admin/audit" allowed={can('audit.read')} />
    <div className="settings-readonly-row"><Clock3 size={19} /><div><strong>Session and password controls</strong><p>These protected controls are reserved for a future system-owner security workspace.</p></div><span>Protected</span></div>
  </div>;
}

function ActionRow({ icon, title, description, to, allowed, confirmLeave }) {
  if (!allowed) return <div className="settings-readonly-row"><span className="settings-action-icon">{icon}</span><div><strong>{title}</strong><p>{description}</p></div><span>Not permitted</span></div>;
  return <Link className="settings-action-row" to={to} onClick={(event) => { if (confirmLeave && !confirmLeave()) event.preventDefault(); }}><span className="settings-action-icon">{icon}</span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} aria-hidden="true" /></Link>;
}

function SaveBar({ dirty, saving, onCancel }) {
  return <footer className="settings-save-bar"><span className={dirty ? 'is-dirty' : ''}>{dirty ? 'Unsaved changes' : <><CheckCircle2 size={16} /> All changes saved</>}</span><div><Button type="button" variant="secondary" onClick={onCancel} disabled={!dirty || saving}>Discard</Button><Button type="submit" loading={saving} disabled={!dirty} iconRight={<Save size={15} />}>Save changes</Button></div></footer>;
}
