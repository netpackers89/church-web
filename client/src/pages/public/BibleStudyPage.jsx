import PageHero from '../../components/layout/PageHero.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { ArrowRight, CalendarDays } from 'lucide-react';

export default function BibleStudyPage() {
  const groups = useAsync(async () => {
    const res = await publicService.bibleStudyGroups({ limit: 6 });
    return unwrap(res) ?? [];
  }, []);

  return (
    <div className="app-main">
      <PageHero eyebrow="Bible study" title="Grow together in the Word" subtitle="Find a small group for Scripture, conversation, and prayer." imageUrl="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1920&q=85" />
      <div className="container-wide" style={{ padding: '0 0 3.5rem' }}>
        <div className="section-head" style={{ marginBottom: '2rem' }}>
          <span className="eyebrow blue"><span className="dot" /> Bible study</span>
          <h1 className="serif" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)' }}>Mid-week groups &amp; study times</h1>
          <p className="lead">Small-group Scripture study across the parish. Whether you are new to faith or a lifelong learner, find a group that fits your week.</p>
        </div>

        {groups.loading ? (
          <div className="grid-auto">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : groups.error ? (
          <ErrorMessage error={groups.error} />
        ) : groups.data && groups.data.length > 0 ? (
          <div className="grid-auto">
            {groups.data.map((g) => (
              <div key={g.id ?? g.title} className="card card-hover">
                <div className="card-body">
                  <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge">Bible study</span>
                    <span className="badge badge-neutral">{g.meetingDay ? (g.meetingDay.charAt(0).toUpperCase() + g.meetingDay.slice(1)) : ''}</span>
                  </div>
                  {g.title ? <h3>{g.title}</h3> : null}
                  {g.meetingTime ? <p className="muted">{g.meetingTime}</p> : null}
                  {g.location ? <p className="muted" style={{ marginTop: '0.2rem' }}>{g.location}</p> : null}
                  {g.description ? <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.92rem' }}>{g.description}</p> : null}
                  {g.url ? <Button to={g.url} variant="light" iconRight={<ArrowRight size={15} />} style={{ marginTop: '0.7rem' }}>Join</Button> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<CalendarDays size={30} />} title="No study groups yet" description="Groups are organised through your church leader. Contact the office to be connected." />
        )}
      </div>
    </div>
  );
}
