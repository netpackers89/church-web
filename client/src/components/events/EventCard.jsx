import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, CalendarDays, Clock3, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { eventYearMonth, formatEventDate } from '../../utils/formatDate.js';
import Button from '../ui/Button.jsx';
import fallbackEvent from '../../assets/hero.png';

/**
 * Reusable event card. Date badge honors the Ethiopian/Gregorian preference.
 * Links to the event detail page. Uses a placeholder image with graceful
 * fallback when an event has no banner yet.
 */
export default function EventCard({ event }) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const dialogRef = useRef(null);
  const { calendar } = useSettings();
  const start = event.startAt || event.startsAt || event.date || event.startDate;
  const { day, month } = eventYearMonth(start, calendar);
  const detailHref = `/events/${event.id ?? event.slug ?? ''}`;
  const end = event.endAt || event.endsAt;
  const now = Date.now();
  const startTime = start ? new Date(start).getTime() : null;
  const endTime = end ? new Date(end).getTime() : (startTime ? startTime + 2 * 60 * 60 * 1000 : null);
  const timezone = event.timezone || 'Africa/Addis_Ababa';
  const localDay = (timestamp) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp));
  const status = event.status === 'POSTPONED'
    ? 'Postponed'
    : event.status === 'CANCELLED'
      ? 'Cancelled'
      : startTime && now >= endTime
        ? 'Completed'
        : startTime && (now >= startTime || localDay(now) === localDay(startTime))
          ? 'Happening today'
            : startTime
              ? `${Math.max(1, Math.ceil((startTime - now) / 86400000))} days left`
              : 'Scheduled';

    useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (quickViewOpen && !dialog.open) dialog.showModal();
      if (!quickViewOpen && dialog.open) dialog.close();
    }, [quickViewOpen]);

  return (
    <article className="card card-hover event-card">
      <div className="event-media">
        <img
          src={event.imageUrl || event.bannerUrl || fallbackEvent}
          alt={event.title ? `${event.title} event banner` : 'Event banner'}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackEvent; }}
        />
        {day ? (
          <span className="event-date" aria-hidden="true">
            <strong>{day}</strong>
            <span>{month}</span>
          </span>
        ) : null}
        <span className={`event-status event-status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>
      </div>
      <div className="event-body">
        <div className="event-card-kickers">
          <span className="badge">{event.category || (event.programType === 'RECURRING' ? 'Regular Program' : 'Church Program')}</span>
          {event.programType === 'RECURRING' ? <span className="event-recurring">Weekly</span> : null}
        </div>
        <h3>{event.title}</h3>
        {(event.summary || event.description) ? <p className="muted event-description">{event.summary || event.description}</p> : null}
        <div className="event-meta">
          {start ? (
            <span className="m"><CalendarDays aria-hidden="true" /> {formatEventDate(start, calendar)} · {new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: timezone })}</span>
          ) : null}
          {event.location ? (
            <span className="m"><MapPin aria-hidden="true" /> {event.location}</span>
          ) : null}
        </div>
        <div className="event-actions">
          <Button type="button" variant="secondary" size="sm" iconRight={<ArrowRight size={14} />} onClick={() => setQuickViewOpen(true)}>Quick view</Button>
          <Link className="event-full-details" to={detailHref}>Full details</Link>
          {event.requiresRegistration ? <Link className="event-register-link" to={`${detailHref}?register=1`}>Register</Link> : null}
        </div>
      </div>
      <dialog
        ref={dialogRef}
        className="event-quick-dialog"
        aria-labelledby={`event-dialog-title-${event.id}`}
        onClose={() => setQuickViewOpen(false)}
        onClick={(clickEvent) => {
          if (clickEvent.target === dialogRef.current) setQuickViewOpen(false);
        }}
      >
        <div className="event-quick-content">
          <button className="event-quick-close" type="button" aria-label="Close event details" onClick={() => setQuickViewOpen(false)}>
            <X size={19} aria-hidden="true" />
          </button>
          <div className="event-quick-image">
            <img src={event.imageUrl || event.bannerUrl || fallbackEvent} alt={event.title ? `${event.title} event banner` : 'Event banner'} onError={(imageEvent) => { imageEvent.currentTarget.src = fallbackEvent; }} />
            <span className={`event-status event-status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>
          </div>
          <div className="event-quick-body">
            <span className="eyebrow blue"><span className="dot" />{event.category || (event.programType === 'RECURRING' ? 'Regular program' : 'Church gathering')}</span>
            <h2 id={`event-dialog-title-${event.id}`}>{event.title}</h2>
            {event.description ? <p className="event-quick-description">{event.description}</p> : null}
            <div className="event-quick-countdown" aria-live="polite">
              <span className="event-quick-countdown-label"><Clock3 size={14} aria-hidden="true" />Time until gathering</span>
              <EventCountdown startTime={startTime} endTime={endTime} />
            </div>
            <div className="event-quick-meta">
              {start ? <span><CalendarDays size={16} aria-hidden="true" />{formatEventDate(start, calendar)} · {new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: timezone })}</span> : null}
              {event.location ? <span><MapPin size={16} aria-hidden="true" />{event.location}</span> : null}
            </div>
            <div className="event-quick-actions">
              <Button to={detailHref} variant="primary" iconRight={<ArrowRight size={16} />}>Full details</Button>
              {event.requiresRegistration ? <Link className="event-register-link" to={`${detailHref}?register=1`}>Register</Link> : null}
            </div>
          </div>
        </div>
      </dialog>
    </article>
  );
}

function EventCountdown({ startTime, endTime }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!startTime) return <strong>Time to be announced</strong>;
  if (startTime <= now && endTime > now) return <strong>Happening now</strong>;
  if (endTime <= now) return <strong>This gathering has ended</strong>;
  return <strong>{formatCountdown(startTime - now)}</strong>;
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

