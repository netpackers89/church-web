import { Building2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const ORG_FALLBACK = [
  { name: 'Church Choir', tag: 'Music & worship' },
  { name: 'Youth (20–35)', tag: 'Young adults' },
  { name: 'Fellowship (15–19)', tag: 'High-school students' },
  { name: "Men's Association", tag: 'Men’s ministry' },
  { name: "Women's Association", tag: 'Women’s ministry' },
];

export default function OrganizationsPage() {
  const orgs = useAsync(async () => unwrap(await publicService.organizations()) ?? [], []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Organizations</h1>
          <p>Church organizations and departments you can be part of.</p>
        </div>
      </div>

      <DataState
        query={orgs}
        feature="Organizations"
        endpoint="/public/organizations"
        emptyState={
          <EmptyState
            icon={<Building2 size={30} />}
            title="Organizations directory is being published"
            description="The organizations directory is being prepared. In the meantime, contact the church office to learn how to join a department."
            action={<Link to="/contact" className="btn btn-secondary btn-sm">Contact the office</Link>}
          />
        }
      >
        {(list) => (
          <div className="grid-auto">
            {list.map((o) => (
              <Link key={o.id ?? o.name} to={`/me/organizations/${o.id}`} className="card card-hover">
                <div className="card-body">
                  <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span className="badge">{o.type ?? 'Organization'}</span>
                  </div>
                  <h3>{o.name}</h3>
                  {o.description ? <p className="muted" style={{ fontSize: '0.9rem', marginTop: '0.3rem' }}>{o.description}</p> : null}
                  <div className="event-meta" style={{ marginTop: '0.6rem' }}>
                    {o.memberCount ? <span className="m"><Users size={14} /> {o.memberCount} members</span> : null}
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
