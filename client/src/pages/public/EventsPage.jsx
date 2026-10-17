import { CalendarDays } from 'lucide-react';
import PageHero from '../../components/layout/PageHero.jsx';
import EventCard from '../../components/events/EventCard.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap } from '../../services/api.js';
import { useState } from 'react';

/** Public events listing. Loads from the public events API with graceful states. */
export default function EventsPage() {
  const [view, setView] = useState('all');
  const { data, loading, error, reload } = useAsync(async () => {
    const res = await publicService.events({ limit: 100 });
    const list = unwrap(res);
    return Array.isArray(list) ? list : [];
  }, []);
  const visibleEvents = (data ?? []).filter((event) => (
    view === 'all' || (view === 'regular' ? event.programType === 'RECURRING' : event.programType !== 'RECURRING')
  ));

  return (
    <>
      <PageHero
        eyebrow="Events"
        title="What's happening at our church"
        subtitle="Worship nights, outreach, conferences, and gatherings for every generation. Everyone is welcome."
        imageUrl="https://images.unsplash.com/photo-1508997449629-303059a039c0?auto=format&fit=crop&w=1920&q=85"
      />
      <section className="section-sm">
        <div className="container">
          <div className="events-toolbar" role="tablist" aria-label="Filter church programs">
            {[
              ['all', 'All programs'],
              ['regular', 'Regular programs'],
              ['special', 'Special events'],
            ].map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={view === value} className={view === value ? 'events-filter active' : 'events-filter'} onClick={() => setView(value)}>
                {label}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="event-grid">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <ErrorMessage error={error} onRetry={reload} title="We couldn't load events" />
          ) : visibleEvents.length > 0 ? (
            <div className="event-grid">
              {visibleEvents.map((event) => (
                <EventCard key={event.id ?? event.slug ?? event.title} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title={view === 'regular' ? 'No regular programs published' : view === 'special' ? 'No special events published' : 'No programs posted yet'}
              description="New gatherings will appear here when the church publishes them."
              action={{ to: '/contact', label: 'Ask about events' }}
            />
          )}
        </div>
      </section>
    </>
  );
}
