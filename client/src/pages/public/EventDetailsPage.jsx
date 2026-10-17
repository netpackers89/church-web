import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Clock, ArrowRight, Map } from 'lucide-react';
import PageHero from '../../components/layout/PageHero.jsx';
import Button from '../../components/ui/Button.jsx';
import EventCard from '../../components/events/EventCard.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import { formatEventDate } from '../../utils/formatDate.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { eventsService } from '../../services/index.js';
import Alert from '../../components/ui/Alert.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

export default function EventDetailsPage() {
  const { id } = useParams();
  const { calendar } = useSettings();
  const { user } = useAuth();
  const { success } = useToast();
  const [pageOpenedAt] = useState(() => Date.now());
  const [registering, setRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');

  const event = useAsync(async () => {
    const res = await publicService.event(id);
    return unwrap(res);
  }, [id]);

  if (event.loading) {
    return (
      <div className="app-main">
        <PageHero eyebrow="Event" title="Event details" imageUrl="https://images.unsplash.com/photo-1508997449629-303059a039c0?auto=format&fit=crop&w=1920&q=85" />
        <div className="container" style={{ padding: '2rem 0 4rem' }}>
          <div className="row" style={{ gap: '1rem', marginBottom: '1.2rem' }}>
            <div className="skeleton" style={{ width: '20rem', height: '1.6rem' }} />
            <div className="skeleton" style={{ width: '12rem', height: '1.6rem' }} />
          </div>
          <div className="grid-2">
            <div className="card skeleton" style={{ height: '16rem' }} />
            <div className="card skeleton" style={{ height: '14rem' }} />
          </div>
        </div>
      </div>
    );
  }

  if (event.error) return <ErrorMessage error={event.error} />;

  const eve = event.data ?? null;
  const eventEnd = eve?.endAt ? new Date(eve.endAt).getTime() : (eve?.startAt ? new Date(eve.startAt).getTime() + 2 * 60 * 60 * 1000 : null);
  const isUpcoming = eve?.startAt ? eventEnd > pageOpenedAt : true;
  const timezone = eve?.timezone || 'Africa/Addis_Ababa';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(pageOpenedAt));
  const eventDay = eve?.startAt ? new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(eve.startAt)) : '';
  const eventStatus = eve?.status === 'CANCELLED'
    ? 'Cancelled'
    : eve?.status === 'POSTPONED'
      ? 'Postponed'
      : eventEnd <= pageOpenedAt
        ? 'Completed'
        : eventDay === today
          ? 'Happening today'
          : 'Upcoming';

  async function register() {
    setRegistering(true);
    setRegistrationMessage('');
    try {
      await eventsService.register(id);
      setRegistrationMessage('You are registered for this event.');
      success('Registration complete');
    } catch (error) {
      setRegistrationMessage(error.message || 'Could not complete event registration.');
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="app-main">
      <PageHero
        eyebrow={eve?.category || 'Church event'}
        title={eve?.title || 'Event details'}
        subtitle={eve?.description}
        imageUrl={eve?.imageUrl || 'https://images.unsplash.com/photo-1508997449629-303059a039c0?auto=format&fit=crop&w=1920&q=85'}
      />
      <div className="container-wide" style={{ padding: '0 0 3.5rem' }}>
        <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'stretch' }}>
          <div className="card card-elevated">
            {eve?.imageUrl ? (
              <img src={eve.imageUrl} alt={eve.title || 'Event'} style={{ width: '100%', height: '15rem', objectFit: 'cover', borderRadius: 'var(--r-lg) 0 0 0', display: 'block' }} />
            ) : null}
          </div>
          <div className="card card-elevated" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge">{eventStatus}</span>
              {eve?.category ? <span className="badge badge-neutral">{eve.category}</span> : null}
            </div>
            <h1 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)' }}>{eve?.title || 'Event details'}</h1>
            {eve?.description ? <p className="muted" style={{ marginTop: '0.6rem', lineHeight: 1.7 }}>{eve.description}</p> : null}
            <div className="grid-2" style={{ marginTop: '1.1rem', gap: '1.1rem', paddingTop: '1.1rem', borderTop: '1px solid var(--line)' }}>
              {(eve?.startAt || eve?.endAt) ? (
                <div className="row">
                  <Clock size={16} style={{ color: 'var(--blue)' }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{eve.startAt ? new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: timezone }).format(new Date(eve.startAt)) : ''}</div>
                    <div className="muted">
                      {eve.startAt ? formatEventDate(eve.startAt, calendar) : ''}
                      {eve.startAt ? ' · ' + new Date(eve.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: timezone }) : ''}
                      {eve.endAt ? ' - ' + new Date(eve.endAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: timezone }) : ''}
                    </div>
                  </div>
                </div>
              ) : null}
              {eve?.location ? (
                <div className="row">
                  <MapPin size={16} style={{ color: 'var(--blue)' }} />
                  <div><div style={{ fontWeight: 700 }}>Location</div><div className="muted">{eve.location}</div></div>
                </div>
              ) : null}
              {eve?.venue ? (
                <div className="row">
                  <Map size={16} style={{ color: 'var(--blue)' }} />
                  <div><div style={{ fontWeight: 700 }}>Venue</div><div className="muted">{eve.venue}</div></div>
                </div>
              ) : null}
            </div>
            <div className="row" style={{ marginTop: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
              {eve?.rsvpUrl ? <Button href={eve.rsvpUrl} iconRight={ArrowRight}>RSVP</Button> : null}
              {eve?.requiresRegistration && isUpcoming ? (user
                ? <Button onClick={register} loading={registering}>Register for this event</Button>
                : <Button to="/login">Sign in to register</Button>) : null}
              {isUpcoming ? <Button to="/events" iconRight={ArrowRight}>View all events</Button> : null}
            </div>
            {registrationMessage ? <Alert variant={registrationMessage.includes('registered') ? 'success' : 'danger'}>{registrationMessage}</Alert> : null}
          </div>
        </div>
        <UpcomingStrip limit={4} />
      </div>
    </div>
  );
}

function UpcomingStrip({ limit = 4, label = "What\u2019s Next" }) {
  const events = useAsync(async () => {
    const res = await publicService.upcomingEvents({ limit });
    return unwrap(res) ?? [];
  }, []);

  if (events.loading) return <div className="event-grid">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="card skeleton" style={{ height: '9rem' }} />)}</div>;
  if (events.error || !events.data?.length) return null;
  return (
    <section className="section-sm section-paper" style={{ paddingTop: '1.2rem' }}>
      <div className="row-between" style={{ marginBottom: '0.6rem' }}>
        <span className="eyebrow blue"><span className="dot" /> {label}</span>
        <Button variant="ghost" iconRight={ArrowRight} to="/events">More events</Button>
      </div>
      <div className="event-grid">{events.data.slice(0, 4).map((e) => <EventCard key={e.id ?? e.title} event={e} />)}</div>
    </section>
  );
}

