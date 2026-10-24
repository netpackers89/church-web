import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../ui/Button.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import ErrorMessage from '../feedback/ErrorMessage.jsx';
import './ProgramsCalendar.css';

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa';

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateInTimezone(value, timezone) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function timeInTimezone(value, timezone) {
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function churchToday() {
  const key = dateInTimezone(Date.now(), DEFAULT_TIMEZONE);
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function ProgramsCalendar() {
  const [month, setMonth] = useState(churchToday);
  const [selectedDate, setSelectedDate] = useState(() => dateInTimezone(Date.now(), DEFAULT_TIMEZONE));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const from = dateKey(year, monthIndex, 1);
  const to = dateKey(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate());
  const calendar = useAsync(async () => {
    const response = await publicService.calendarEvents({ from, to });
    return {
      events: unwrap(response) ?? [],
      timezone: response.data?.timezone || DEFAULT_TIMEZONE,
    };
  }, [from, to]);
  const timezone = calendar.data?.timezone || DEFAULT_TIMEZONE;
  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const event of calendar.data?.events ?? []) {
      const key = dateInTimezone(event.startAt, event.timezone || timezone);
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [calendar.data, timezone]);
  const days = Array.from({ length: new Date(year, monthIndex, 1).getDay() }, () => null)
    .concat(Array.from({ length: new Date(year, monthIndex + 1, 0).getDate() }, (_, index) => index + 1));
  const selectedEvents = eventsByDay.get(selectedDate) ?? [];

  function changeMonth(offset) {
    const nextMonth = new Date(year, monthIndex + offset, 1);
    setMonth(nextMonth);
    setSelectedDate(dateKey(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  }

  return (
    <section className="section section-paper programs-calendar-section" aria-labelledby="program-calendar-title">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow blue"><CalendarDays size={14} /> Church calendar</span>
          <h2 className="serif" id="program-calendar-title">Plan a visit</h2>
          <p className="lead">Browse published gatherings by date. Recurring programs appear once per scheduled occurrence.</p>
        </div>
        <div className="program-calendar">
          <div className="program-calendar-month">
            <h3>{new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthIndex, 15)))}</h3>
            <div className="program-calendar-controls">
              <Button variant="secondary" size="sm" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={17} /></Button>
              <Button variant="secondary" size="sm" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={17} /></Button>
            </div>
          </div>
          {calendar.loading ? <p className="muted" role="status">Loading the calendar…</p> : null}
          {calendar.error ? <ErrorMessage error={calendar.error} onRetry={calendar.reload} title="Calendar events could not be loaded" /> : null}
          {!calendar.loading && !calendar.error ? (
            <>
              <div className="program-calendar-grid" role="grid" aria-label="Events by date">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => <span className="program-calendar-weekday" role="columnheader" key={weekday}>{weekday}</span>)}
                {days.map((day, index) => {
                  const key = day ? dateKey(year, monthIndex, day) : `blank-${index}`;
                  const hasEvents = day ? eventsByDay.has(key) : false;
                  return day ? (
                    <button
                      className={`program-calendar-day${selectedDate === key ? ' is-selected' : ''}${hasEvents ? ' has-events' : ''}`}
                      type="button"
                      role="gridcell"
                      aria-pressed={selectedDate === key}
                      aria-label={`${new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(year, monthIndex, day))}${hasEvents ? ', events scheduled' : ''}`}
                      key={key}
                      onClick={() => setSelectedDate(key)}
                    >
                      <span>{day}</span>
                      {hasEvents ? <i aria-hidden="true" /> : null}
                    </button>
                  ) : <span className="program-calendar-day is-blank" role="gridcell" key={key} aria-hidden="true" />;
                })}
              </div>
              <div className="program-calendar-agenda" aria-live="polite">
                <h4>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: DEFAULT_TIMEZONE }).format(new Date(`${selectedDate}T12:00:00Z`))}</h4>
                {selectedEvents.length ? selectedEvents.map((event) => (
                  <Link className="program-calendar-event" to={`/events/${event.id}`} key={event.id}>
                    <span><strong>{event.title}</strong><small>{event.category || 'Church gathering'}{event.location ? ` · ${event.location}` : ''}</small></span>
                    <span className="program-calendar-event-time"><Clock3 size={14} />{timeInTimezone(event.startAt, event.timezone || timezone)}</span>
                  </Link>
                )) : <EmptyState icon={CalendarDays} title="Nothing scheduled for this date" description="Choose a highlighted date to see its published events." />}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
