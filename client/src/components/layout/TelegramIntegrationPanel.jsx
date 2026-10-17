import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, ExternalLink, LoaderCircle, MessageCircle, ShieldCheck, Unlink } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';
import { userService } from '../../services/api.js';
import { useToast } from '../feedback/ToastProvider.jsx';

function getProfile(response) {
  return response.data?.data ?? response.data?.user ?? {};
}

export default function TelegramIntegrationPanel({ compact = false }) {
  const { success } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [link, setLink] = useState(null);
  const [status, setStatus] = useState('NOT_CONNECTED');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [telegramPreference, setTelegramPreference] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [flowError, setFlowError] = useState('');
  const polling = useRef(false);

  useEffect(() => {
    let active = true;
    userService.profile().then((response) => {
      if (!active) return;
      const nextProfile = getProfile(response);
      setProfile(nextProfile);
      setStatus(nextProfile.telegramConnected ? 'CONNECTED' : 'NOT_CONNECTED');
      setTelegramPreference(Boolean(nextProfile.notifyTelegram));
    }).catch(() => {
      if (active) setFlowError('Telegram connection status could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!link || status !== 'WAITING') return undefined;
    let active = true;
    async function checkStatus() {
      if (polling.current) return;
      polling.current = true;
      try {
        const response = await userService.telegramLinkStatus(link.token);
        const result = response.data?.data ?? response.data ?? {};
        if (!active) return;
        if (result.status === 'CONNECTED') {
          setStatus('CONNECTED');
          setProfile((current) => ({
            ...current,
            telegramConnected: true,
            telegramUsername: result.username ?? current?.telegramUsername ?? null,
            telegramLinkedAt: result.linkedAt ?? current?.telegramLinkedAt ?? null,
          }));
          setLink(null);
          success('Telegram connected', 'Your Telegram account is linked to your church profile.');
        } else if (result.status === 'EXPIRED') {
          setStatus('EXPIRED');
          setLink(null);
        }
      } catch (failure) {
        if (active && failure.status === 404) {
          setStatus('EXPIRED');
          setLink(null);
        }
      } finally {
        polling.current = false;
      }
    }

    void checkStatus();
    const pollTimer = window.setInterval(checkStatus, 2000);
    const countdownTimer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((link.expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 1000);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.clearInterval(countdownTimer);
    };
  }, [link, status, success]);

  async function connect() {
    setConnecting(true);
    setFlowError('');
    setStatus('CREATING');
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const response = await userService.telegramLinkToken();
      const result = response.data ?? {};
      const deepLink = result.deepLink || result.url;
      const token = result.token;
      if (!deepLink || !token) throw new Error('The server did not return a secure Telegram link.');
      const expiresAt = result.expiresAt ? new Date(result.expiresAt).getTime() : Date.now() + (result.expiresInSeconds ?? 300) * 1000;
      setLink({ token, deepLink, expiresAt });
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
      setStatus('WAITING');
      if (tab) tab.location.replace(deepLink);
    } catch (failure) {
      tab?.close();
      setStatus('NOT_CONNECTED');
      setFlowError(failure.message || 'Telegram could not be connected right now.');
    } finally {
      setConnecting(false);
    }
  }

  async function updateTelegramPreference(event) {
    const nextValue = event.target.checked;
    setSavingPreference(true);
    setFlowError('');
    try {
      await userService.updateNotificationPreferences({ notifyTelegram: nextValue });
      setTelegramPreference(nextValue);
      success('Telegram notification preference saved');
    } catch (failure) {
      setFlowError(failure.message || 'Could not update Telegram notification preference.');
    } finally {
      setSavingPreference(false);
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Telegram and stop Telegram notifications for your account?')) return;
    setDisconnecting(true);
    setFlowError('');
    try {
      await userService.telegramUnlink();
      setProfile((current) => ({ ...current, telegramConnected: false, telegramUsername: null, telegramLinkedAt: null, notifyTelegram: false }));
      setTelegramPreference(false);
      setStatus('NOT_CONNECTED');
      setLink(null);
      success('Telegram disconnected');
    } catch (failure) {
      setFlowError(failure.message || 'Telegram could not be disconnected.');
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status === 'CONNECTED' || Boolean(profile?.telegramConnected);

  return (
    <section className={`telegram-settings-panel${compact ? ' is-compact' : ''}`} aria-labelledby="telegram-settings-title">
      <header className="telegram-settings-heading">
        <span className="telegram-settings-icon"><MessageCircle size={18} aria-hidden="true" /></span>
        <div>
          <div className="telegram-settings-title-row">
            <h3 id="telegram-settings-title">Telegram</h3>
            <span className={`telegram-settings-badge${connected ? ' is-connected' : ''}`} role="status">
              {connected ? <><Check size={13} aria-hidden="true" />Verified</> : 'Not connected'}
            </span>
          </div>
          <p>Link Telegram to receive church updates through the official bot.</p>
        </div>
      </header>

      {flowError ? <Alert variant="warning">{flowError}</Alert> : null}
      {loading ? <p className="telegram-settings-muted" role="status">Checking connection…</p> : null}

      {connected ? (
        <div className="telegram-settings-connected">
          <div className="telegram-settings-identity">
            <ShieldCheck size={17} aria-hidden="true" />
            <div>
              <strong>{profile?.telegramUsername ? `@${profile.telegramUsername.replace(/^@/, '')}` : 'Telegram account connected'}</strong>
              {profile?.telegramLinkedAt ? <span>Connected {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(profile.telegramLinkedAt))}</span> : null}
            </div>
          </div>
          <label className="telegram-settings-preference">
            <input type="checkbox" checked={telegramPreference} disabled={savingPreference || !connected} onChange={updateTelegramPreference} />
            <span>Receive Telegram notifications</span>
          </label>
          <Button type="button" variant="secondary" size="sm" loading={disconnecting} iconLeft={<Unlink size={15} />} onClick={disconnect}>Disconnect Telegram</Button>
        </div>
      ) : status === 'WAITING' && link ? (
        <div className="telegram-settings-waiting" role="status" aria-live="polite">
          <div className="telegram-settings-waiting-title"><LoaderCircle size={16} className="telegram-settings-spinner" />Waiting for you to tap START in Telegram</div>
          <p><Clock3 size={14} aria-hidden="true" /> Link expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</p>
          <a href={link.deepLink} target="_blank" rel="noreferrer"><ExternalLink size={15} aria-hidden="true" />Open Telegram</a>
          <button type="button" className="telegram-settings-cancel" onClick={() => { setLink(null); setStatus('NOT_CONNECTED'); }}>Cancel</button>
        </div>
      ) : (
        <div className="telegram-settings-connect">
          <p className="telegram-settings-muted">Telegram linking is optional. Your account remains usable if you skip it.</p>
          <Button type="button" loading={loading || connecting} onClick={connect}><MessageCircle size={16} />Connect Telegram</Button>
          {status === 'EXPIRED' ? <span className="telegram-settings-muted">The previous link expired. Create a new one to try again.</span> : null}
        </div>
      )}
    </section>
  );
}
