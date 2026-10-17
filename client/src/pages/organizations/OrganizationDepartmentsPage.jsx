import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Users } from 'lucide-react';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

export default function OrganizationDepartmentsPage() {
  const { id } = useParams();
  const departments = useAsync(async () => {
    const res = await publicService.organizationDepartments(id);
    return unwrap(res) ?? [];
  }, [id]);

  return (
    <div className="stack-lg">
      <Link to={`/me/organizations/${id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={14} /> Back to organization
      </Link>

      <div className="page-head">
        <div>
          <h1>Departments</h1>
          <p>Sub-groups within this organization.</p>
        </div>
      </div>

      <DataState
        query={departments}
        feature="Departments"
        endpoint={`/public/organizations/${id}/departments`}
        emptyState={
          <EmptyState
            icon={<Building2 size={30} />}
            title="No departments listed"
            description="Departments will appear here once the organization publishes them."
          />
        }
      >
        {(list) => (
          <div className="grid-auto">
            {list.map((d) => (
              <Link key={d.id ?? d.name} to={`/me/departments/${d.id}`} className="card card-hover">
                <div className="card-body">
                  <h3>{d.name}</h3>
                  {d.description ? <p className="muted" style={{ fontSize: '0.9rem', marginTop: '0.3rem' }}>{d.description}</p> : null}
                  <div className="event-meta" style={{ marginTop: '0.6rem' }}>
                    {d.memberCount ? <span className="m"><Users size={14} /> {d.memberCount} members</span> : null}
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
