import { useState } from 'react';
import { ArrowUpRight, Clock3, Mail, MapPin, Phone, Send } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { publicService } from '../../services/api.js';
import { siteConfig } from '../../utils/siteConfig.js';

const DIRECTIONS_URL = 'https://www.google.com/maps/dir/?api=1&destination=9.057601743589627%2C38.873814303814214';
const MAP_EMBED_URL = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d785.5888138125316!2d38.873814303814214!3d9.057601743589627!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b9111e3fcf36f%3A0x8616e9cdcb4983ac!2sYeka%20Abado%20Full%20Gospel%20Church%20Building%20Construction%20place!5e1!3m2!1sen!2set!4v1791904443660!5m2!1sen!2set';

export default function ContactVisitSection() {
  const { success } = useToast();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setSendError('');
    try {
      await publicService.contact(form);
      setSent(true);
      success('Message sent', 'The church team will respond as soon as possible.');
    } catch (error) {
      setSendError(error.message || 'Could not send your message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="visit" className="about-visit-section">
      <div className="container">
        <div className="about-visit-heading">
          <span className="eyebrow blue"><span className="dot" /> Visit &amp; contact</span>
          <h2 className="serif">There’s a place for you here.</h2>
          <p>Come worship with us, ask a question, or simply let us know you’re coming.</p>
        </div>

        <div className="about-visit-grid">
          <div className="about-visit-details">
            <div className="about-visit-facts">
              <div className="fact-row">
                <span className="fact-icon"><MapPin size={18} aria-hidden="true" /></span>
                <div><strong>Find us</strong><span>{siteConfig.address}</span></div>
              </div>
              <div className="fact-row">
                <span className="fact-icon"><Clock3 size={18} aria-hidden="true" /></span>
                <div><strong>Gather with us</strong><span>{siteConfig.serviceSummary}</span></div>
              </div>
              {siteConfig.phone ? (
                <div className="fact-row">
                  <span className="fact-icon"><Phone size={18} aria-hidden="true" /></span>
                  <div><strong>Call</strong><a href={`tel:${siteConfig.phone}`}>{siteConfig.phone}</a></div>
                </div>
              ) : null}
              {siteConfig.email ? (
                <div className="fact-row">
                  <span className="fact-icon"><Mail size={18} aria-hidden="true" /></span>
                  <div><strong>Email</strong><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></div>
                </div>
              ) : null}
            </div>
            <div className="about-visit-map">
              <iframe
                title={`${siteConfig.churchName} location map`}
                src={MAP_EMBED_URL}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <a className="about-directions-link" href={DIRECTIONS_URL} target="_blank" rel="noreferrer">
              Open directions <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>

          <div className="about-visit-message">
            {sent ? (
              <div role="status">
                <Alert variant="success">Thank you for reaching out. Your message has been received by the church team.</Alert>
                <Button variant="secondary" onClick={() => setSent(false)}>Write another message</Button>
              </div>
            ) : (
              <form className="form-grid" onSubmit={handleSubmit}>
                <div>
                  <span className="eyebrow blue">A note to our team</span>
                  <h3>How can we help?</h3>
                </div>
                {sendError ? <Alert variant="danger">{sendError}</Alert> : null}
                <Input label="Your name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                <Input label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
                <Input label="Phone (optional)" type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                <Input label="Subject" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} required />
                <label className="field">
                  <span>Message</span>
                  <textarea className="textarea" rows={5} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} required />
                </label>
                <Button type="submit" loading={busy} iconRight={<Send size={15} />}>Send message</Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}