import { useParams, Link } from 'react-router-dom';
import { Clock, MapPin, Users, ArrowLeft } from 'lucide-react';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Button from '../../components/ui/Button.jsx';

export default function BibleStudyDetailsPage() {
  const { id } = useParams();
  const group = useAsync(async () => unwrap(await publicService.bibleStudyGroup(id)), [id]);

  return (
    <div className="stack-lg">
      <Link to="/me/bible-study" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} /> All groups
      </Link>

      <DataState query={group} feature="Bible study group" endpoint={`/public/bible-study-groups/${id}`} skeletonCount={1} isEmpty={() => false}>
        {(g) => (
          <div className="card card-pad-lg">
            <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <span className="badge">Bible study</span>
              {g.meetingDay ? <span className="badge badge-neutral">{g.meetingDay}s</span> : null}
            </div>
            <h1 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)' }}>{g.title || 'Study group'}</h1>
            {g.description ? <p className="lead" style={{ marginTop: '0.8rem' }}>{g.description}</p> : null}

            <div className="grid-3" style={{ marginTop: '1.4rem', paddingTop: '1.4rem', borderTop: '1px solid var(--line)' }}>
              {g.meetingTime ? (
                <div className="fact-row"><div className="fact-icon"><Clock size={16} /></div><div><strong>Meets</strong><span>{g.meetingDay ? `${g.meetingDay}s ` : ''}{g.meetingTime}</span></div></div>
              ) : null}
              {g.location ? (
                <div className="fact-row"><div className="fact-icon"><MapPin size={16} /></div><div><strong>Where</strong><span>{g.location}</span></div></div>
              ) : null}
              {g.leader ? (
                <div className="fact-row"><div className="fact-icon"><Users size={16} /></div><div><strong>Leader</strong><span>{g.leader}</span></div></div>
              ) : null}
            </div>

            <div className="row" style={{ marginTop: '1.4rem', flexWrap: 'wrap', gap: '0.7rem' }}>
              <Button to="/contact" variant="primary">Join this group</Button>
              <Button to="/me/bible-study" variant="secondary">Browse other groups</Button>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
