import { BookOpen, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';

export default function BibleStudyGroupsPage() {
  const groups = useAsync(async () => unwrap(await publicService.bibleStudyGroups()) ?? [], []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Bible study groups</h1>
          <p>Find a mid-week group that fits your schedule and stage of life.</p>
        </div>
      </div>

      <DataState
        query={groups}
        feature="Bible study groups"
        endpoint="/public/bible-study-groups"
        emptyState={
          <EmptyState
            icon={<BookOpen size={30} />}
            title="No groups listed yet"
            description="Groups are announced each term. Contact your small group leader or the church office to join one."
            action={<Button to="/contact" variant="secondary">Ask about groups</Button>}
          />
        }
      >
        {(list) => (
          <div className="grid-auto">
            {list.map((g) => (
              <Link key={g.id ?? g.title} to={`/me/bible-study/groups/${g.id}`} className="card card-hover">
                <div className="card-body">
                  <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge">Bible study</span>
                    {g.meetingDay ? <span className="badge badge-neutral">{g.meetingDay}</span> : null}
                  </div>
                  {g.title ? <h3>{g.title}</h3> : null}
                  {g.leader ? <p className="muted" style={{ fontSize: '0.9rem' }}>Led by {g.leader}</p> : null}
                  <div className="event-meta" style={{ marginTop: '0.6rem' }}>
                    {g.meetingTime ? <span className="m"><Clock size={14} /> {g.meetingTime}</span> : null}
                    {g.location ? <span className="m"><MapPin size={14} /> {g.location}</span> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DataState>
    </div>
  );
}
