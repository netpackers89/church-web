import { ScrollText, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatEventDate } from '../../utils/formatDate.js';

export default function AuditLogsPage() {
  const logs = useAsync(async () => {
    const res = await adminService.auditLogs({ limit: 100 });
    return res?.data?.data ?? res?.data ?? [];
  }, []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>A record of sensitive administrative actions.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" size="sm" onClick={logs.reload} iconRight={<RefreshCw size={14} />}>Refresh</Button>
        </div>
      </div>

      <DataState
        query={logs}
        feature="Audit log"
        endpoint="/admin/audit-logs"
        skeletonCount={1}
        emptyState={
          <EmptyState
            icon={<ScrollText size={30} />}
            title="No audit entries yet"
            description="Administrative actions such as role changes and settings updates will be recorded here."
          />
        }
      >
        {(list) => (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {list.map((entry) => (
                  <tr key={entry.id ?? `${entry.createdAt}-${entry.action}`}>
                    <td className="muted">{entry.createdAt ? formatEventDate(entry.createdAt.slice(0, 10), 'gregorian') : '—'}</td>
                    <td><strong>{entry.actorName ?? entry.actor ?? 'system'}</strong></td>
                    <td><span className="badge badge-neutral">{entry.action ?? entry.type ?? 'action'}</span></td>
                    <td className="muted">{entry.details ?? entry.description ?? '—'}</td>
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
