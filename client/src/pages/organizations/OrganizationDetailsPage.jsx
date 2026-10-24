import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Users, CalendarDays } from 'lucide-react';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Button from '../../components/ui/Button.jsx';

export default function OrganizationDetailsPage() {
  const { id } = useParams();
  const org = useAsync(async () => unwrap(await publicService.organization(id)), [id]);

  return (
    <div className="stack-lg">
      <Link to="/ministries" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} /> All organizations
      </Link>

      <DataState query={org} feature="Organization" endpoint={`/public/organizations/${id}`} skeletonCount={1} isEmpty={() => false}>
        {(o) => (
          <div className="card card-pad-lg">
            <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <span className="badge">{o.type ?? 'Organization'}</span>
            </div>
            <h1 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.1rem)' }}>{o.name || 'Organization'}</h1>
            {o.description ? <p className="lead" style={{ marginTop: '0.8rem' }}>{o.description}</p> : null}

            <div className="row" style={{ marginTop: '1.4rem', flexWrap: 'wrap', gap: '0.7rem' }}>
              <Button to={`/me/organizations/${id}/departments`} iconRight={<Building2 size={15} />}>View departments</Button>
              <Button to="/me/events" variant="secondary" iconRight={<CalendarDays size={15} />}>Organization events</Button>
              <Button to="/contact" variant="ghost" iconRight={<Users size={15} />}>How to join</Button>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
