import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, CalendarDays, MapPin } from 'lucide-react';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Button from '../../components/ui/Button.jsx';

export default function DepartmentDetailsPage() {
  const { id } = useParams();
  const department = useAsync(async () => unwrap(await publicService.department(id)), [id]);

  return (
    <div className="stack-lg">
      <Link to="/me/organizations" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} /> Back
      </Link>

      <DataState query={department} feature="Department" endpoint={`/public/departments/${id}`} skeletonCount={1} isEmpty={() => false}>
        {(d) => (
          <div className="card card-pad-lg">
            <h1 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)' }}>{d.name || 'Department'}</h1>
            {d.description ? <p className="lead" style={{ marginTop: '0.8rem' }}>{d.description}</p> : null}

            <div className="grid-3" style={{ marginTop: '1.4rem', paddingTop: '1.4rem', borderTop: '1px solid var(--line)' }}>
              {d.leader ? (
                <div className="fact-row"><div className="fact-icon"><Users size={16} /></div><div><strong>Leader</strong><span>{d.leader}</span></div></div>
              ) : null}
              {d.meetingSchedule ? (
                <div className="fact-row"><div className="fact-icon"><CalendarDays size={16} /></div><div><strong>Meets</strong><span>{d.meetingSchedule}</span></div></div>
              ) : null}
              {d.location ? (
                <div className="fact-row"><div className="fact-icon"><MapPin size={16} /></div><div><strong>Where</strong><span>{d.location}</span></div></div>
              ) : null}
            </div>

            <div className="row" style={{ marginTop: '1.4rem', flexWrap: 'wrap', gap: '0.7rem' }}>
              <Button to="/contact" variant="primary">Join this department</Button>
              <Button to="/me/events" variant="secondary">Upcoming events</Button>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
