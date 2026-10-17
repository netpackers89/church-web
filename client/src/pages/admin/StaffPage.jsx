import { UserCog, Users } from 'lucide-react';
import { userService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const STAFF_ROLES = ['ADMIN', 'PASTOR', 'LEADER', 'FINANCE', 'REGISTRAR'];
const ROLE_ORDER = { ADMIN: 0, PASTOR: 1, LEADER: 2, FINANCE: 3, REGISTRAR: 4 };

export default function StaffPage() {
  const staff = useAsync(async () => {
    const all = unwrap(await userService.directory()) ?? [];
    return (Array.isArray(all) ? all : [])
      .filter((m) => STAFF_ROLES.includes(m.role))
      .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
  }, []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Staff &amp; leaders</h1>
          <p>Accounts with a staff or leadership role.</p>
        </div>
      </div>

      <DataState
        query={staff}
        feature="Staff directory"
        endpoint="/users"
        skeletonCount={1}
        emptyState={<EmptyState icon={<UserCog size={30} />} title="No staff accounts" description="Staff accounts will appear here once roles are assigned." />}
      >
        {(list) => (
          <div className="grid-auto">
            {list.map((m) => (
              <div key={m.id ?? m.email} className="card card-body">
                <div className="row" style={{ gap: '0.8rem' }}>
                  <span className="brand-mark" style={{ width: '2.6rem', height: '2.6rem', fontSize: '0.9rem' }}>
                    {(m.name || 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block' }}>{m.name}</strong>
                    <span className="muted" style={{ fontSize: '0.82rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>
                  </div>
                </div>
                <div className="row" style={{ marginTop: '0.7rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <Badge variant={m.role === 'ADMIN' ? 'danger' : m.role === 'PASTOR' || m.role === 'FINANCE' ? 'warning' : 'neutral'}>{m.role}</Badge>
                  <Badge variant={(m.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'success' : 'warning'}>{m.accountStatus ?? 'ACTIVE'}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataState>
    </div>
  );
}
