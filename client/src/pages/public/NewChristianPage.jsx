import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, CheckCircle2, Phone, Mail, MapPin, MessageSquareHeart } from 'lucide-react';
import PageHero from '../../components/layout/PageHero.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Input from '../../components/ui/Input.jsx';
import { publicService } from '../../services/api.js';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const CONTACT_METHODS = [
  { value: 'phone', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'Amharic' },
  { value: 'om', label: 'Afaan Oromoo' },
  { value: 'ti', label: 'Tigrinya' },
];

export default function NewChristianPage() {
  const { success } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [followupAccess, setFollowupAccess] = useState(null);
  const [telegramLink, setTelegramLink] = useState(null);
  const [telegramStatus, setTelegramStatus] = useState('NOT_CONNECTED');
  const [telegramError, setTelegramError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    location: '',
    preferredContactMethod: 'phone',
    preferredLanguage: 'en',
    acceptedJesus: '',
    consentToContact: false,
    prayerRequest: '',
  });

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
        preferredContactMethod: form.preferredContactMethod,
        preferredLanguage: form.preferredLanguage,
        acceptedJesus: form.acceptedJesus,
        consentToContact: form.consentToContact,
        prayerRequest: form.prayerRequest.trim(),
      };

      const response = await publicService.newChristian(payload);
      const followup = response.data?.data;
      const linkSecret = response.data?.linkSecret;
      if (followup?.id && linkSecret) setFollowupAccess({ id: followup.id, linkSecret });
      setSubmitted(true);
      success('Thank you for sharing this step', response?.data?.message || 'A member of the church team will follow up with you soon.');
    } catch (failure) {
      setError(failure.message || 'We could not save your response. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!followupAccess || !telegramLink) return undefined;
    let active = true;
    let checking = false;
    const checkStatus = async () => {
      if (checking) return;
      if (Date.now() >= telegramLink.expiresAt) {
        setTelegramStatus('EXPIRED');
        return;
      }
      checking = true;
      try {
        const response = await publicService.newChristianTelegramStatus({
          followupId: followupAccess.id,
          linkSecret: followupAccess.linkSecret,
        });
        if (active) setTelegramStatus(response.data?.data?.status ?? 'WAITING');
      } catch (failure) {
        if (active) {
          setTelegramStatus('FAILED');
          setTelegramError(failure.message || 'Could not check Telegram connection status.');
        }
      } finally {
        checking = false;
      }
    };
    void checkStatus();
    const timer = window.setInterval(checkStatus, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [followupAccess, telegramLink]);

  async function startTelegramConnection() {
    if (!followupAccess) return;
    setBusy(true);
    setTelegramError('');
    try {
      const response = await publicService.newChristianTelegramLinkToken({
        followupId: followupAccess.id,
        linkSecret: followupAccess.linkSecret,
      });
      const url = response.data?.url;
      if (!url) throw new Error('The church bot did not return a connection link.');
      setTelegramLink({ url, expiresAt: Date.now() + (response.data.expiresInSeconds ?? 600) * 1000 });
      setTelegramStatus('WAITING');
    } catch (failure) {
      setTelegramStatus('FAILED');
      setTelegramError(failure.message || 'Telegram could not be connected right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Welcome"
        title="I Have Accepted Jesus"
        subtitle="We are grateful to walk with you. Share a few details below and our follow-up team will contact you with prayer, support, and next steps."
        imageUrl="https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=85"
      />

      <section className="section-sm">
        <div className="container" style={{ maxWidth: '960px' }}>
          <div className="give-layout" style={{ alignItems: 'flex-start' }}>
            <div className="stack-lg">
              <div className="card card-pad-lg">
                <div className="row" style={{ alignItems: 'center', gap: '0.8rem' }}>
                  <div className="fact-icon"><Heart size={18} /></div>
                  <div>
                    <span className="eyebrow blue"><span className="dot" /> A caring welcome</span>
                    <h3 style={{ margin: '0.5rem 0 0', fontFamily: 'var(--font-display)' }}>A safe, welcoming place to begin</h3>
                  </div>
                </div>
                <p className="muted" style={{ marginTop: '1rem', lineHeight: 1.7 }}>
                  Whether you have just accepted Jesus Christ or are still seeking answers, we would be glad to pray with you, listen, and help you take your next step in faith.
                </p>
                <ul className="feature-list" style={{ marginTop: '1rem' }}>
                  <li><CheckCircle2 size={16} /> Prayer and encouragement</li>
                  <li><MessageSquareHeart size={16} /> A follow-up team to support you</li>
                  <li><Phone size={16} /> Contact through your preferred method</li>
                </ul>
              </div>

              <div className="card card-pad-lg">
                <h3 style={{ fontFamily: 'var(--font-display)' }}>What happens next?</h3>
                <ol className="simple-list" style={{ marginTop: '0.75rem' }}>
                  <li>Your response is saved securely.</li>
                  <li>An authorized follow-up team member reviews it.</li>
                  <li>You are contacted according to your preferred method.</li>
                </ol>
              </div>
            </div>

            <div className="card card-elevated card-pad-lg" style={{ flex: '1 1 440px' }}>
              {submitted ? (
                <div className="stack-lg">
                  <Alert variant="success">{form.acceptedJesus === 'yes'
                    ? 'Your response has been received. We are grateful you shared this step of faith with us.'
                    : 'Your response has been received. We would be glad to pray with you or help you learn more about Jesus.'}</Alert>
                  <section className="telegram-followup-connect" aria-labelledby="followup-telegram-title">
                    <div>
                      <h3 id="followup-telegram-title">Connect Telegram (optional)</h3>
                      <p className="muted">Receive your welcome message and, with your consent, follow-up messages and relevant church updates. Telegram is linked securely through our church bot, not by username.</p>
                    </div>
                    <p className="telegram-connection-state" role="status">
                      {telegramStatus === 'CONNECTED' ? 'Connected successfully'
                        : telegramStatus === 'WAITING' ? 'Waiting for Telegram confirmation'
                          : telegramStatus === 'EXPIRED' ? 'Connection link expired'
                            : telegramStatus === 'FAILED' ? 'Connection failed'
                              : 'Not connected'}
                    </p>
                    {telegramError ? <Alert variant="warning">{telegramError}</Alert> : null}
                    {telegramStatus === 'CONNECTED' ? null : telegramLink && telegramStatus === 'WAITING' ? (
                      <a className="btn btn-secondary" href={telegramLink.url} target="_blank" rel="noreferrer">Open church bot</a>
                    ) : followupAccess ? (
                      <Button variant="secondary" loading={busy} onClick={startTelegramConnection}>
                        {telegramStatus === 'EXPIRED' || telegramStatus === 'FAILED' ? 'Try connecting again' : 'Connect Telegram'}
                      </Button>
                    ) : null}
                  </section>
                  {form.acceptedJesus !== 'yes' ? <p className="muted">You can also <Link to="/contact">speak with a pastor</Link> or send a prayer request. You do not need to create an account.</p> : null}
                  <Button to="/" variant="primary">Back to home</Button>
                </div>
              ) : (
                <form className="form-grid" onSubmit={handleSubmit}>
                  {error ? <Alert variant="danger">{error}</Alert> : null}

                  <Input label="Full name" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} required />
                  <div className="modern-register-grid">
                    <Input label="Phone number" type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} required />
                    <Input label="Email (optional)" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
                  </div>
                  <Input label="Location or neighborhood" value={form.location} onChange={(event) => updateField('location', event.target.value)} required />

                  <label className="field">
                    <span>Preferred contact method</span>
                    <select value={form.preferredContactMethod} onChange={(event) => updateField('preferredContactMethod', event.target.value)}>
                      {CONTACT_METHODS.map((method) => (
                        <option key={method.value} value={method.value}>{method.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Preferred language</span>
                    <select value={form.preferredLanguage} onChange={(event) => updateField('preferredLanguage', event.target.value)}>
                      {LANGUAGE_OPTIONS.map((language) => (
                        <option key={language.value} value={language.value}>{language.label}</option>
                      ))}
                    </select>
                  </label>

                  <div className="field">
                    <span>Have you accepted Jesus Christ as your personal Lord and Savior?</span>
                    <div className="radio-list" style={{ marginTop: '0.5rem' }}>
                      <label>
                        <input
                          type="radio"
                          name="acceptedJesus"
                          checked={form.acceptedJesus === 'yes'}
                          onChange={() => updateField('acceptedJesus', 'yes')}
                        />
                        Yes
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="acceptedJesus"
                          checked={form.acceptedJesus === 'not-yet'}
                          onChange={() => updateField('acceptedJesus', 'not-yet')}
                        />
                        Not yet
                      </label>
                    </div>
                  </div>

                  <label className="field">
                    <span>Optional prayer request or message</span>
                    <textarea className="textarea" rows={4} value={form.prayerRequest} onChange={(event) => updateField('prayerRequest', event.target.value)} placeholder="Tell us how we can pray for you or what you would like to learn." />
                  </label>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={form.consentToContact}
                      onChange={(event) => updateField('consentToContact', event.target.checked)}
                    />
                    <span>I give consent to be contacted by the church for spiritual guidance and follow-up.</span>
                  </label>

                  <Button type="submit" variant="primary" size="lg" loading={busy} iconRight={<ArrowRight size={16} />}>
                    {busy ? 'Submitting...' : 'Submit my response'}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
