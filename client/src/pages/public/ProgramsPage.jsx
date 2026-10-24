import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import PageHero from '../../components/layout/PageHero.jsx';
import EventCard from '../../components/events/EventCard.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap } from '../../services/api.js';
import ProgramsCalendar from '../../components/events/ProgramsCalendar.jsx';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(value) {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

function formatDate(value, timezone) {
  if (!value) return 'Schedule to be announced';
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(value));
}

function ScheduleCard({ program, timezone }) {
  const schedule = program.schedules[0];
  const recurringLabels = program.schedules.map((item) => {
    const weekday = WEEKDAYS[Number(item.weekday)];
    return weekday ? `Every ${weekday}${item.startTime ? ` · ${formatTime(item.startTime)}` : ''}` : null;
  }).filter(Boolean);
  return (
    <article className="card card-pad-lg">
      <span className="eyebrow blue"><CalendarDays size={14} /> Regular program</span>
      <h2 style={{ marginTop: '0.65rem' }}>{program.name}</h2>
      {recurringLabels.length ? <p className="muted" style={{ marginTop: '0.45rem' }}>{recurringLabels.join(' · ')}</p> : null}
      <p className="muted" style={{ marginTop: '0.65rem' }}>{formatDate(schedule.nextAt, schedule.timezone || timezone)}</p>
      {schedule.startTime ? (
        <p className="row muted" style={{ gap: '0.45rem', marginTop: '0.45rem' }}>
          <Clock3 size={15} aria-hidden="true" />
          {formatTime(schedule.startTime)}{schedule.endTime ? ` – ${formatTime(schedule.endTime)}` : ''}
        </p>
      ) : null}
      {schedule.locationName || schedule.address ? (
        <p className="row muted" style={{ gap: '0.45rem', marginTop: '0.45rem' }}>
          <MapPin size={15} aria-hidden="true" />
          {[schedule.locationName, schedule.address].filter(Boolean).join(' · ')}
        </p>
      ) : null}
    </article>
  );
}

export default function ProgramsPage() {
  const schedules = useAsync(async () => {
    const response = await publicService.programSchedules();
    return {
      data: unwrap(response) ?? [],
      timezone: response.data?.timezone || 'Africa/Addis_Ababa',
    };
  }, []);
  const events = useAsync(async () => {
    const response = await publicService.upcomingEvents({ limit: 50 });
    const list = unwrap(response);
    return Array.isArray(list) ? list.filter((event) => event.programType !== 'RECURRING') : [];
  }, []);
  const regularPrograms = new Map();
  for (const schedule of schedules.data?.data ?? []) {
    const key = String(schedule.programId ?? schedule.name);
    const program = regularPrograms.get(key) ?? { id: key, name: schedule.name, schedules: [] };
    program.schedules.push(schedule);
    regularPrograms.set(key, program);
  }

  return (
    <>
      <PageHero
        eyebrow="Programs"
        title="Find your place in the community"
        subtitle="Join us for worship, prayer, study, and special gatherings throughout the year."
        imageUrl="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1920&q=85"
      />
      <section className="section-sm">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow blue"><span className="dot" /> Every week</span>
            <h2 className="serif">Regular programs</h2>
            <p className="lead">Schedules shown here come from the church’s current published program calendar.</p>
          </div>
          {schedules.loading ? (
            <div className="event-grid">{Array.from({ length: 3 }, (_, index) => <CardSkeleton key={index} />)}</div>
          ) : schedules.error ? (
            <ErrorMessage error={schedules.error} onRetry={schedules.reload} title="Program schedules could not be loaded" />
          ) : regularPrograms.size ? (
            <div className="event-grid">
              {[...regularPrograms.values()].map((program) => <ScheduleCard key={program.id} program={program} timezone={schedules.data.timezone} />)}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No regular programs published" description="Please check back later or contact the church for the current schedule." action={{ to: '/contact', label: 'Contact the church' }} />
          )}
        </div>
      </section>
      <section className="section section-paper">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow blue"><span className="dot" /> Special gatherings</span>
            <h2 className="serif">Upcoming events</h2>
            <p className="lead">Conferences, celebrations, and other one-time gatherings.</p>
          </div>
          {events.loading ? (
            <div className="event-grid">{Array.from({ length: 3 }, (_, index) => <CardSkeleton key={index} />)}</div>
          ) : events.error ? (
            <ErrorMessage error={events.error} onRetry={events.reload} title="Upcoming events could not be loaded" />
          ) : events.data?.length ? (
            <div className="event-grid">{events.data.map((event) => <EventCard key={event.id} event={event} />)}</div>
          ) : (
            <EmptyState icon={CalendarDays} title="No special events announced" description="New gatherings will appear here when they are published." />
          )}
        </div>
      </section>
      <ProgramsCalendar />
    </>
  );
}