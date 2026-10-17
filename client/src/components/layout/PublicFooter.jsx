import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Send } from 'lucide-react';
import Brand from '../ui/Brand.jsx';
import { siteConfig } from '../../utils/siteConfig.js';
import { useAuth } from '../../context/AuthContext.jsx';

/* lucide-react no longer ships brand icons; small inline glyphs stand in. */
function YoutubeGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

/** Comprehensive footer: contact, navigation, service times, social links. */
export default function PublicFooter() {
  const year = new Date().getFullYear();
  const { user } = useAuth();
  return (
    <footer className="site-footer">
      <div className="container-wide">
        <div className="footer-grid">
          <div>
            <Brand to="/" variant="footer" />
            <p className="muted" style={{ marginTop: '1rem', maxWidth: '22rem' }}>
              {siteConfig.serviceSummary}. A welcoming home for worship, discipleship, and community.
            </p>
            <div className="footer-social" style={{ marginTop: '1.25rem' }}>
              {siteConfig.social.youtube ? <SocialLink href={siteConfig.social.youtube} label="YouTube"><YoutubeGlyph /></SocialLink> : null}
              {siteConfig.social.facebook ? <SocialLink href={siteConfig.social.facebook} label="Facebook"><FacebookGlyph /></SocialLink> : null}
              {siteConfig.social.telegram ? <SocialLink href={siteConfig.social.telegram} label="Telegram"><Send size={18} /></SocialLink> : null}
            </div>
          </div>

          <div className="footer-col">
            <h4>Explore</h4>
            <Link to="/about">About the church</Link>
            <Link to="/events">Events</Link>
            <Link to="/sermons">Sermons</Link>
            <Link to="/ministries">Ministries</Link>
            {user ? <Link to="/me/organizations">Departments</Link> : null}
            {user ? <Link to="/me/bible-study">Bible studies</Link> : null}
          </div>

          <div className="footer-col">
            <h4>Get Involved</h4>
            <Link to="/give">Give</Link>
            <Link to="/about#visit">Plan your visit</Link>
            {user ? <Link to="/me/profile">My profile</Link> : <Link to="/register">Become a member</Link>}
            {user ? <Link to="/me/notifications">Notifications</Link> : <Link to="/login">Member portal</Link>}
          </div>

          <div className="footer-col">
            <h4>Visit Us</h4>
            <ul className="footer-contact">
              <li><MapPin aria-hidden="true" /> <span>{siteConfig.address}</span></li>
              {siteConfig.phone ? <li><Phone aria-hidden="true" /> <span>{siteConfig.phone}</span></li> : null}
              {siteConfig.email ? <li><Mail aria-hidden="true" /> <span>{siteConfig.email}</span></li> : null}
            </ul>
            <p style={{ marginTop: '0.9rem', fontSize: '0.84rem', color: 'var(--gold)' }}>
              Sundays · 9:00 AM & 11:00 AM
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} {siteConfig.churchName}. All rights reserved.</span>
          <span>Serving with faith, hope, and love.</span>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, label, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      {children}
    </a>
  );
}

