import { Link } from 'react-router-dom';
import { CalendarDays, BookOpen, Users, HandHeart, Bell, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import EventCard from '../../components/events/EventCard.jsx';
import Button from '../../components/ui/Button.jsx';
import { currentEthiopianDate, formatEthiopian } from '../../utils/formatDate.js';

export default function MemberDashboardPage() {
  const { user } = useAuth();
  const { isEthiopian } = useSettings();

  const events = useAsync(async () => unwrap(await publicService.upcomingEvents({ limit: 3 })) ?? [], []);
  const verse = useAsync(async () => unwrap(await publicService.dailyVerse()), []);

  const todayEc = currentEthiopianDate();
  const firstName = (user?.name || 'Friend').split(' ')[0];

  const quickLinks = [
    { to: '/me/calendar', icon: CalendarDays, label: 'My calendar', note: 'Your personal church calendar' },
    { to: '/me/bible-study', icon: BookOpen, label: 'Bible study', note: 'Groups you can join' },
    { to: '/me/organizations', icon: Users, label: 'Organizations', note: 'Youth, fellowship & departments' },
    { to: '/me/giving', icon: HandHeart, label: 'My giving', note: 'Campaigns and your giving history' },
  ];

  return (
    <div className="stack-lg">
      <div className="card card-elevated" style={{ padding: 'clamp(1.5rem, 3vw, 2.2rem)', background: 'linear-gradient(135deg, var(--navy), var(--navy-2))', color: '#fff', border: 'none' }}>
        <div className="row-between">
          <div>
            <span className="eyebrow"><span className="dot" /> Welcome back</span>
            <h1 className="serif" style={{ fontSize: 'clamp(1.7rem, 3vw, 2.3rem)', color: '#fff', marginTop: '0.5rem' }}>
              {firstName}, grace and peace to you
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '0.5rem' }}>
              Today is {formatEthiopian(todayEc)} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="badge badge-on-dark">{user?.role}</span>
            {user?.emailVerified ? <span className="badge badge-gold">Email verified</span> : <span className="badge badge-warning">Verify email</span>}
          </div>
        </div>
      </div>

      <section>
        <div className="row-between" style={{ marginBottom: '0.8rem' }}>
          <span className="eyebrow blue"><span className="dot" /> Verse of the day</span>
          <Button to="/me/notifications" variant="ghost" size="sm" iconRight={<Bell size={14} />}>Notification settings</Button>
        </div>
        <div className="verse-card verse-lite" style={{ borderRadius: 'var(--r-lg)' }}>
          {verse.loading ? (
            <div className="skeleton" style={{ height: '1.8rem', width: '60%', margin: '0 auto' }} />
          ) : verse.data?.text ? (
            <>
              <div className="verse-quote-mark" aria-hidden="true">&ldquo;</div>
              <blockquote>{verse.data.text}</blockquote>
              {verse.data.reference ? <span className="verse-ref" style={{ color: 'var(--blue)' }}>{verse.data.reference}</span> : null}
            </>
          ) : (
            <p className="muted" style={{ padding: '0.5rem 0' }}>The verse of the day is not available right now. Please check back later.</p>
          )}
        </div>
      </section>

      <section>
        <div className="row-between" style={{ marginBottom: '0.8rem' }}>
          <span className="eyebrow blue"><span className="dot" /> Coming up</span>
          <Button to="/me/events" variant="ghost" size="sm" iconRight={<ArrowRight size={14} />}>All events</Button>
        </div>
        {events.loading ? (
          <div className="event-grid">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton" style={{ height: '10rem' }} />)}</div>
        ) : events.data && events.data.length > 0 ? (
          <div className="event-grid">{events.data.map((e) => <EventCard key={e.id ?? e.title} event={e} />)}</div>
        ) : (
          <div className="card"><p className="muted card-body">No upcoming events right now. Check the public events page for details.</p></div>
        )}
      </section>

      <section>
        <span className="eyebrow blue" style={{ marginBottom: '0.8rem', display: 'inline-flex' }}><span className="dot" /> Quick actions</span>
        <div className="grid-auto">
          {quickLinks.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.to} to={q.to} className="card card-hover">
                <div className="card-body row" style={{ alignItems: 'flex-start', gap: '0.9rem' }}>
                  <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.6rem', height: '2.6rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)', flex: 'none' }}>
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong style={{ display: 'block' }}>{q.label}</strong>
                    <span className="muted" style={{ fontSize: '0.86rem' }}>{q.note}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
