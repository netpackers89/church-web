import { useState } from 'react';
import { Building, BookOpen, Users, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { groupService } from '../../services/index.js';
import { unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';

export default function MyGroupsPage() {
  const [tab, setTab] = useState('all');

  const followedGroups = useAsync(
    async () => unwrap(await groupService.followed()) ?? [],
    []
  );

  const allGroups = (followedGroups.data ?? []).map((g) => ({
    ...g,
    typeLabel: g.type === 'department' ? 'Department' : 'Bible study',
    icon: g.type === 'department' ? <Building size={20} /> : <BookOpen size={20} />,
  }));

  const filtered = tab === 'all'
    ? allGroups
    : allGroups.filter((g) => g.type === (tab === 'departments' ? 'department' : 'bible_study_group'));

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>My Groups</h1>
          <p>Departments and Bible study groups you follow. Their updates will find you here.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
        <button
          onClick={() => setTab('all')}
          className={`btn ${tab === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
        >
          All
        </button>
        <button
          onClick={() => setTab('departments')}
          className={`btn ${tab === 'departments' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
        >
          Departments
        </button>
        <button
          onClick={() => setTab('bible_study_group')}
          className={`btn ${tab === 'bible_study_group' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
        >
          Bible Studies
        </button>
      </div>

      <DataState
        query={followedGroups}
        feature="My groups"
        endpoint="/api/groups/followed"
        emptyState={
          <EmptyState
            icon={<Users size={30} />}
          title="You are not following any groups yet"
            description="Browse departments and Bible study groups. Following subscribes you to group posts and updates; it does not join an external Telegram group."
            action={<Button to="/community" variant="secondary">Browse groups</Button>}
          />
        }
      >
        {() => {
          if (filtered.length === 0) {
            return (
              <EmptyState
                icon={tab === 'departments' ? <Building size={30} /> : <BookOpen size={30} />}
                title={`No ${tab === 'departments' ? 'departments' : 'Bible study groups'} followed`}
                description="Follow groups to keep their updates together here."
              />
            );
          }

          return (
            <div className="grid-auto">
              {filtered.map((g) => (
                <div key={g.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {g.bannerUrl && (
                    <div style={{ width: '100%', height: 160, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f1f5f9', marginBottom: '0.75rem' }}>
                      <ReliableImage src={g.bannerUrl} alt={`${g.name} banner`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div className="card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      {g.icon}
                      <span className="badge badge-success" style={{ fontSize: '0.72rem', marginLeft: 'auto' }}>Following</span>
                    </div>
                    <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.1rem', fontWeight: 700 }}>{g.name}</h3>
                    <p className="muted" style={{ fontSize: '0.86rem', marginBottom: '0.7rem', lineHeight: 1.4 }}>{g.description ?? ''}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', color: '#64748b', marginBottom: 'auto' }}>
                      <Users size={14} />
                      <span>{g.memberCount ?? 0} members</span>
                      {g.meetingSchedule && (
                        <>
                          <Clock size={14} />
                          <span>{g.meetingSchedule}</span>
                        </>
                      )}
                    </div>
                    <Link className="btn btn-primary btn-sm btn-block" to={`/community/${g.type === 'department' ? 'departments' : 'bible-study-groups'}/${g.id}`}>
                      <ArrowRight size={14} /> Open group
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      </DataState>
    </div>
  );
}
