import { BarChart3, Users, CalendarDays, HandHeart, Download } from 'lucide-react';
import { useState } from 'react';
import { adminService } from '../../services/index.js';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import DataState from '../../components/ui/DataState.jsx';
import useAsync from '../../hooks/useAsync.js';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const REPORT_TYPES = [
  { id: 'members', label: 'Members overview', icon: Users, note: 'Totals by role, status, and location.' },
  { id: 'events', label: 'Events report', icon: CalendarDays, note: 'Event attendance and upcoming schedule.' },
  { id: 'giving', label: 'Giving summary', icon: HandHeart, note: 'Campaign progress and totals. Finance roles only.' },
];

export default function ReportsPage() {
  const [active, setActive] = useState('members');

  const report = useAsync(async () => {
    const res = await adminService.reports(active);
    return res?.data?.data ?? res?.data ?? null;
  }, [active]);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Operational summaries for church leadership.</p>
        </div>
      </div>

      <div className="chip-row">
        {REPORT_TYPES.map((r) => (
          <button key={r.id} type="button" className={`chip ${active === r.id ? 'active' : ''}`} onClick={() => setActive(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="card card-pad-lg">
        <div className="row-between" style={{ marginBottom: '1rem' }}>
          <div className="row">
            {(() => { const R = REPORT_TYPES.find((x) => x.id === active)?.icon ?? BarChart3; return <R size={18} style={{ color: 'var(--blue)' }} />; })()}
            <div>
              <h2 className="serif" style={{ fontSize: '1.25rem' }}>{REPORT_TYPES.find((x) => x.id === active)?.label}</h2>
              <p className="muted" style={{ fontSize: '0.86rem' }}>{REPORT_TYPES.find((x) => x.id === active)?.note}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" disabled iconRight={<Download size={14} />}>Export</Button>
        </div>

        <DataState
          query={report}
          feature="Reports"
          endpoint={`/admin/reports/${active}`}
          skeletonCount={1}
          isEmpty={(d) => !d}
          emptyState={<Alert variant="info">This report will populate once the reporting API is connected.</Alert>}
        >
          {(data) => (
            <div className="grid-auto">
              {Object.entries(data ?? {}).map(([key, value]) => (
                <div key={key} className="stat-card">
                  <span className="stat-value">{typeof value === 'object' ? '—' : String(value)}</span>
                  <span className="stat-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                </div>
              ))}
            </div>
          )}
        </DataState>
      </div>
    </div>
  );
}
