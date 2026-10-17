import { Building2 } from 'lucide-react';
import { adminService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';

export default function OrganizationsAdminPage() {
  const orgs = useAsync(async () => unwrap(await adminService.organizations()) ?? [], []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Organizations</h1>
          <p>Manage church organizations and their departments from one directory.</p>
        </div>
        <div className="page-actions">
          <Button to="/admin/registrations?type=organization" variant="primary" iconRight={<Building2 size={15} />}>New organization</Button>
        </div>
      </div>

      <DataState
        query={orgs}
        feature="Organizations management"
        endpoint="/admin/organizations"
        emptyState={
          <EmptyState
            icon={<Building2 size={30} />}
            title="No organizations yet"
            description="Organizations such as the choir, youth, and associations will be listed here."
          />
        }
      >
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Organization</th><th>Departments</th><th>Leader</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id ?? o.name}>
                    <td><strong>{o.name}</strong></td>
                    <td className="muted">{o.departmentCount ?? 0}</td>
                    <td className="muted">{o.leaderName ?? '—'}</td>
                    <td className="muted">{o.isActive ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>
    </div>
  );
}
