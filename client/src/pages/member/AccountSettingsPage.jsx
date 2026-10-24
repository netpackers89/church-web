import { useEffect, useState } from 'react';
import { KeyRound, Mail, Bell, Send } from 'lucide-react';
import { userService } from '../../services/api.js';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import TelegramIntegrationPanel from '../../components/layout/TelegramIntegrationPanel.jsx';

export default function AccountSettingsPage() {
  const { success, error: toastError } = useToast();

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdDone, setPwdDone] = useState(false);

  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const [prefs, setPrefs] = useState({ notifyEmail: null });
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsStatus, setPrefsStatus] = useState('loading');
  const [prefsError, setPrefsError] = useState('');
  const [prefsRetry, setPrefsRetry] = useState(0);

  useEffect(() => {
    let active = true;
    userService.profile().then((response) => {
      const profile = response.data?.data ?? response.data?.user ?? {};
      if (typeof profile.notifyEmail !== 'boolean') {
        throw new Error('The notification preference was missing from the profile response.');
      }
      if (active) {
        setPrefs({ notifyEmail: profile.notifyEmail });
        setPrefsStatus('ready');
        setPrefsError('');
      }
    }).catch((error) => {
      if (active) {
        setPrefsStatus('error');
        setPrefsError(error.message || 'Notification preferences could not be loaded.');
      }
    });
    return () => { active = false; };
  }, [prefsRetry]);

  async function handlePassword(e) {
    e.preventDefault();
    setPwdDone(false);
    const next = {};
    if (!pwd.current) next.current = 'Enter your current password.';
    if (pwd.next.length < 10) next.next = 'New password must be at least 10 characters.';
    if (pwd.next !== pwd.confirm) next.confirm = 'Passwords do not match.';
    setPwdErrors(next);
    if (Object.keys(next).length) return;
    setPwdBusy(true);
    try {
      await userService.updatePassword({ currentPassword: pwd.current, newPassword: pwd.next });
      setPwd({ current: '', next: '', confirm: '' });
      setPwdDone(true);
      success('Password updated');
    } catch (err) {
      toastError('Could not update password', err?.message);
    } finally {
      setPwdBusy(false);
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    setEmailBusy(true);
    try {
      await userService.requestEmailChange({ email: emailForm.email, currentPassword: emailForm.password });
      setEmailSent(true);
      success('Verification sent', 'Check your inbox to confirm the new address.');
    } catch (err) {
      toastError('Could not request email change', err?.message);
    } finally {
      setEmailBusy(false);
    }
  }

  async function handlePrefs(e) {
    e.preventDefault();
    setPrefsBusy(true);
    try {
      await userService.updateNotificationPreferences({ notifyEmail: prefs.notifyEmail });
      success('Preferences saved');
    } catch (err) {
      toastError('Could not save preferences', err?.message);
    } finally {
      setPrefsBusy(false);
    }
  }

  const anyPref = prefsStatus === 'ready' && prefs.notifyEmail !== null;

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Account &amp; notifications</h1>
          <p>Manage your password, email address, and how the church communicates with you.</p>
        </div>
      </div>

      <section className="card card-pad-lg">
        <div className="row" style={{ marginBottom: '1rem' }}>
          <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><KeyRound size={17} /></span>
          <h2 className="serif" style={{ fontSize: '1.3rem' }}>Change password</h2>
        </div>
        {pwdDone ? <div style={{ marginBottom: '1rem' }}><Alert variant="success">Password updated successfully.</Alert></div> : null}
        <form className="form-grid" onSubmit={handlePassword} noValidate>
          <Input label="Current password" type="password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} error={pwdErrors.current} required />
          <div className="dual-fields">
            <Input label="New password" type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} error={pwdErrors.next} hint="At least 10 characters" required />
            <Input label="Confirm new password" type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} error={pwdErrors.confirm} required />
          </div>
          <div><Button type="submit" loading={pwdBusy}>Update password</Button></div>
        </form>
      </section>

      <TelegramIntegrationPanel />

      <section className="card card-pad-lg">
        <div className="row" style={{ marginBottom: '1rem' }}>
          <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><Mail size={17} /></span>
          <h2 className="serif" style={{ fontSize: '1.3rem' }}>Change email address</h2>
        </div>
        {emailSent ? <div style={{ marginBottom: '1rem' }}><Alert variant="success">A verification link was sent to your new address. It will be confirmed once you click the link.</Alert></div> : null}
        <form className="form-grid" onSubmit={handleEmail} noValidate>
          <Input label="New email" type="email" value={emailForm.email} onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))} required />
          <Input label="Confirm with current password" type="password" value={emailForm.password} onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))} required />
          <div><Button type="submit" loading={emailBusy} iconRight={<Send size={14} />}>Send verification</Button></div>
        </form>
      </section>

      <section className="card card-pad-lg">
        <div className="row" style={{ marginBottom: '1rem' }}>
          <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><Bell size={17} /></span>
          <h2 className="serif" style={{ fontSize: '1.3rem' }}>Notification preferences</h2>
        </div>
        {prefsStatus === 'loading' ? <p className="muted" role="status">Loading your notification preferences…</p> : null}
        {prefsStatus === 'error' ? (
          <div className="stack-sm" style={{ marginBottom: '1rem' }}>
            <Alert variant="danger">Notification preferences could not be loaded: {prefsError}</Alert>
            <Button type="button" variant="secondary" onClick={() => { setPrefsStatus('loading'); setPrefsRetry((retry) => retry + 1); }}>Try again</Button>
          </div>
        ) : null}
        <form className="form-grid" onSubmit={handlePrefs} noValidate>
          <div className="checkbox-row">
            <input id="notify-email-pref" type="checkbox" checked={prefs.notifyEmail ?? false} disabled={!anyPref} onChange={(e) => setPrefs((p) => ({ ...p, notifyEmail: e.target.checked }))} />
            <label htmlFor="notify-email-pref">Email me about events, announcements, and prayer points.</label>
          </div>
          <div><Button type="submit" loading={prefsBusy} disabled={!anyPref || prefsStatus !== 'ready'}>Save preferences</Button></div>
        </form>
      </section>
    </div>
  );
}
