import { BookOpen, Users, CalendarDays } from 'lucide-react';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function MyBibleStudyPage() {
  const { user } = useAuth();

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>My Bible study</h1>
          <p>The group you are assigned to, your schedule, and study materials.</p>
        </div>
      </div>

      <div className="card card-pad-lg">
        <EmptyState
          icon={<BookOpen size={30} />}
          title="You are not assigned to a group yet"
          description="Once a leader assigns you to a Bible study group, your group, meeting schedule, and study notes will appear here."
          action={<Button to="/me/bible-study" variant="primary">Browse groups</Button>}
        />
      </div>

      <div className="grid-2">
        <div className="card card-body">
          <div className="row" style={{ alignItems: 'flex-start', gap: '0.8rem' }}>
            <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)', flex: 'none' }}><Users size={17} /></span>
            <div>
              <strong style={{ display: 'block' }}>Group members</strong>
              <span className="muted" style={{ fontSize: '0.88rem' }}>Your fellow members will be listed here once you join a group.</span>
            </div>
          </div>
        </div>
        <div className="card card-body">
          <div className="row" style={{ alignItems: 'flex-start', gap: '0.8rem' }}>
            <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)', flex: 'none' }}><CalendarDays size={17} /></span>
            <div>
              <strong style={{ display: 'block' }}>Study schedule</strong>
              <span className="muted" style={{ fontSize: '0.88rem' }}>Meeting times and reminders will appear once a group is assigned.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
