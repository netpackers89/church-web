import { Building2 } from 'lucide-react';
import apiClient from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';

/** Existing department directory; new departments use the registration hub. */
export default function DepartmentsPage() {
  const departments = useAsync(async () => {
    const res = await apiClient.get('/admin/departments');
    return res?.data?.data ?? res?.data ?? [];
  }, []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Departments</h1>
          <p>Manage departments across organizations.</p>
        </div>
        <div className="page-actions">
          <Button to="/admin/registrations?type=department" variant="primary" iconRight={<Building2 size={15} />}>New department</Button>
        </div>
      </div>

      <DataState
        query={departments}
        feature="Departments management"
        endpoint="/admin/departments"
        emptyState={
          <EmptyState
            icon={<Building2 size={30} />}
            title="No departments yet"
            description="Departments created under organizations will be listed and manageable here."
          />
        }
      >
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Department</th><th>Organization</th><th>Leader</th><th>Members</th></tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id ?? d.name}>
                    <td><strong>{d.name}</strong></td>
                    <td className="muted">{d.organizationName ?? '—'}</td>
                    <td className="muted">{d.leader ?? '—'}</td>
                    <td className="muted">{d.memberCount ?? '—'}</td>
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
