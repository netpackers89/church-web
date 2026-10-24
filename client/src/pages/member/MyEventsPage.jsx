import { CalendarDays, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import EventCard from '../../components/events/EventCard.jsx';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import { weekdayName } from '../../utils/formatDate.js';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function MyEventsPage() {
  const { calendar } = useSettings();
  const events = useAsync(async () => unwrap(await publicService.upcomingEvents({ limit: 24 })) ?? [], []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>My events</h1>
          <p>Upcoming worship services, gatherings, and special events.</p>
        </div>
        <div className="page-actions">
          <Link to="/me/calendar" className="btn btn-secondary btn-sm"><CalendarDays size={15} /> Calendar view</Link>
          <Link to="/programs" className="btn btn-ghost btn-sm" iconRight={<ArrowRight size={14} />}>Public programs</Link>
        </div>
      </div>

      <DataState
        query={events}
        feature="Events"
        endpoint="/public/events"
        emptyState={
          <EmptyState
            icon={<CalendarDays size={30} />}
            title="No upcoming events"
            description="New events are announced regularly — check the public events page or contact the office."
            action={<Button to="/programs" variant="secondary">Browse programs</Button>}
          />
        }
      >
        {(list) => (
          <div className="grid-auto">
            {list.map((e) => (
              <EventCard key={e.id ?? e.title} event={e} />
            ))}
          </div>
        )}
      </DataState>
    </div>
  );
}
