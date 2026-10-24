import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Send, ArrowUp, Clock3 } from 'lucide-react';
import Brand from '../ui/Brand.jsx';
import { siteConfig } from '../../utils/siteConfig.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap } from '../../services/api.js';

const CURRENT_YEAR = new Date().getFullYear();

/* Inline brand glyphs */
function YoutubeGlyph() {
  return (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55c-.58.155-1.047.62-1.202 1.2-.55 1.872-.55 5.764-.55 5.764s0 3.892.55 5.764c.155.58.62 1.045 1.202 1.2 1.872.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.015 3.015 0 0 0 2.122-2.12c.55-1.872.55-5.764.55-5.764s0-3.892-.55-5.764zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/** Comprehensive footer: contact, navigation, service times, social links. */
export default function PublicFooter() {
  const { user } = useAuth();
  const schedules = useAsync(async () => unwrap(await publicService.programSchedules()) ?? [], []);

  return (
    <footer className="relative bg-slate-950 text-slate-300 font-sans border-t border-slate-800/80 overflow-hidden">
      {/* Decorative subtle background gradient glows */}
      <div className="absolute top-0 left-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 border-b border-slate-800/80">

          {/* Brand & About Column (Spans 4 columns on large screens) */}
          <div className="lg:col-span-4 space-y-4">
            <Brand to="/" variant="footer" />
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              A welcoming community rooted in the love of Jesus and committed to serving our neighbors.
            </p>
            {/* Social Links */}
            <div className="flex items-center space-x-3 pt-2">
              {siteConfig.social.youtube && (
                <SocialLink href={siteConfig.social.youtube} label="YouTube">
                  <YoutubeGlyph />
                </SocialLink>
              )}
              {siteConfig.social.facebook && (
                <SocialLink href={siteConfig.social.facebook} label="Facebook">
                  <FacebookGlyph />
                </SocialLink>
              )}
              {siteConfig.social.telegram && (
                <SocialLink href={siteConfig.social.telegram} label="Telegram">
                  <Send className="w-5 h-5" />
                </SocialLink>
              )}
            </div>
          </div>

          {/* Quick Links Column (Spans 2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">Explore</h4>
            <ul className="space-y-2.5 text-sm">
              <li><FooterLink to="/">Home</FooterLink></li>
              <li><FooterLink to="/programs">Programs</FooterLink></li>
              <li><FooterLink to="/about">About the church</FooterLink></li>
              <li><FooterLink to="/programs">Programs &amp; events</FooterLink></li>
              <li><FooterLink to="/sermons">Sermons</FooterLink></li>
              <li><FooterLink to="/community">Departments &amp; groups</FooterLink></li>
              <li><FooterLink to="/new-christian">New Christian</FooterLink></li>
              <li>
                <FooterLink to="/community">Bible studies</FooterLink>
              </li>
            </ul>
          </div>

          {/* Get Involved Column (Spans 2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">Get Involved</h4>
            <ul className="space-y-2.5 text-sm">
              <li><FooterLink to="/give">Give</FooterLink></li>
              <li><FooterLink to="/about#visit">Plan your visit</FooterLink></li>
              <li>
                {user ? (
                  <FooterLink to="/me/profile">My profile</FooterLink>
                ) : (
                  <FooterLink to="/register">Become a member</FooterLink>
                )}
              </li>
              <li>
                {user ? (
                  <FooterLink to="/me/notifications">Notifications</FooterLink>
                ) : (
                  <FooterLink to="/login">Member portal</FooterLink>
                )}
              </li>
            </ul>
          </div>

          {/* Visit Us Column (Spans 2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">Visit Us</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start space-x-2.5">
                <MapPin className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{siteConfig.address}</span>
              </li>
              {siteConfig.phone && (
                <li className="flex items-center space-x-2.5">
                  <Phone className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
                  <a href={`tel:${siteConfig.phone}`} className="hover:text-slate-200 transition-colors">
                    {siteConfig.phone}
                  </a>
                </li>
              )}
              {siteConfig.email && (
                <li className="flex items-center space-x-2.5">
                  <Mail className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
                  <a href={`mailto:${siteConfig.email}`} className="hover:text-slate-200 transition-colors break-all">
                    {siteConfig.email}
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Service Times Column (Spans 2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold tracking-wider text-slate-100 uppercase">Service Times</h4>

            {schedules.loading && (
              <p className="text-sm text-slate-400 animate-pulse">Loading published schedule…</p>
            )}

            {schedules.error && (
              <FooterLink to="/programs" className="text-sm">View current programs</FooterLink>
            )}

            {!schedules.loading && !schedules.error && schedules.data?.length ? (
              <ul className="space-y-3 text-sm">
                {schedules.data.slice(0, 4).map((schedule) => (
                  <li key={schedule.id} className="flex items-start space-x-2.5">
                    <Clock3 className="w-4 h-4 text-indigo-400 shrink-0 mt-1" aria-hidden="true" />
                    <div className="flex flex-col">
                      <strong className="font-medium text-slate-200">{schedule.name}</strong>
                      <span className="text-xs text-slate-400">{formatScheduleTime(schedule)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {!schedules.loading && !schedules.error && !schedules.data?.length && (
              <FooterLink to="/programs" className="text-sm">See published programs</FooterLink>
            )}
          </div>

        </div>

        {/* Footer Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span>© {CURRENT_YEAR} {siteConfig.churchName}. All rights reserved.</span>
            <span className="hidden sm:inline text-slate-700">•</span>
            <span>Serving with faith, hope, and love.</span>
          </div>

          {/* Back to top button */}
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Back to top
            <ArrowUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true" />
          </a>
        </div>

      </div>
    </footer>
  );
}

/* Helper component for styled footer navigation links */
function FooterLink({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`text-slate-400 hover:text-indigo-400 transition-colors duration-200 inline-block ${className}`}
    >
      {children}
    </Link>
  );
}

/* Helper component for modern social icon buttons */
function SocialLink({ href, label, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 hover:border-slate-700 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {children}
    </a>
  );
}

function formatScheduleTime(schedule) {
  const day = typeof schedule.weekday === 'number'
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedule.weekday]
    : '';
  const time = (value) => {
    const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
    if (!match) return '';
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  };
  const window = [time(schedule.startTime), time(schedule.endTime)].filter(Boolean).join(' – ');
  return [day, window].filter(Boolean).join(' · ') || 'Time to be announced';
}