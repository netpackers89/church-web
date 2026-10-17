import { KeyRound, ShieldCheck } from 'lucide-react';
import Badge from '../../components/ui/Badge.jsx';

/**
 * Static permission matrix derived from the server's role definitions. The
 * server re-validates every action; this table is reference documentation for
 * administrators.
 */
const MATRIX = [
  ['View public site', '✓', '✓', '✓', '✓', '✓', '✓'],
  ['Own profile & settings', '✓', '✓', '✓', '✓', '✓', '✓'],
  ['Member directory', '✓', '✓', '✓', 'Own org', '✓', '✓'],
  ['Assign roles', '✓', 'Request', '—', '—', 'Request', '—'],
  ['Events & schedules', '✓', '✓', '—', 'Own org', '✓', '—'],
  ['Bible study groups', '✓', '✓', '—', 'Own org', '✓', '—'],
  ['Organizations & departments', '✓', '✓', '—', 'Own org', '✓', '—'],
  ['Announcements & banners', '✓', '✓', '—', 'Own org', '✓', '—'],
  ['Campaigns & giving', '✓', '✓', '✓', '—', '—', '—'],
  ['Reports & exports', '✓', '✓', 'Finance', 'Own org', '—', '—'],
  ['Audit log', '✓', '—', '—', '—', '—', '—'],
  ['System settings', '✓', '—', '—', '—', '—', '—'],
];

const COLS = ['ADMIN', 'PASTOR', 'FINANCE', 'LEADER', 'REGISTRAR', 'MEMBER'];

export default function PermissionsPage() {
  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Permissions matrix</h1>
          <p>What each role can access. The server enforces these rules independently.</p>
        </div>
      </div>

      <div className="card card-pad-lg">
        <div className="row" style={{ marginBottom: '1rem' }}>
          <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><KeyRound size={17} /></span>
          <h2 className="serif" style={{ fontSize: '1.25rem' }}>Role capabilities</h2>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Capability</th>
                {COLS.map((c) => <th key={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row[0]}>
                  <td><strong>{row[0]}</strong></td>
                  {row.slice(1).map((cell, i) => (
                    <td key={COLS[i]}>
                      {cell === '✓' ? <Badge variant="success">Full</Badge>
                        : cell === '—' ? <span className="muted">—</span>
                        : <Badge variant="warning">{cell}</Badge>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ marginTop: '1rem', alignItems: 'flex-start', gap: '0.6rem' }}>
          <ShieldCheck size={15} style={{ color: 'var(--success)', marginTop: '0.15rem' }} />
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            “Request” means the role can ask an administrator to perform the action. All changes are recorded in the audit log.
          </p>
        </div>
      </div>
    </div>
  );
}
