import { Shield, Info } from 'lucide-react';
import { adminService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Badge from '../../components/ui/Badge.jsx';

const ROLE_DESCRIPTIONS = {
  SYSTEM_OWNER: 'Protected highest authority. Manages owner authority and administrator appointments.',
  ADMIN: 'Manages permitted platform modules. Cannot grant or alter administrator or system-owner authority.',
  PASTOR: 'Broad management of people, content, and events. Cannot change system settings.',
  FINANCE: 'Campaigns, giving records, and financial reports.',
  LEADER: 'Owns an organization: departments, members, events, and announcements for that organization only.',
  REGISTRAR: 'Member directory management and role assignment requests.',
  MEMBER: 'Standard member: profile, calendar, groups, and giving.',
  PARTNER: 'Partner with extended directory visibility (opt-in).',
};

export default function RolesPage() {
  const roles = useAsync(async () => {
    const res = await adminService.roles();
    return res?.data?.data ?? res?.data ?? [];
  }, []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Roles &amp; permissions</h1>
          <p>Church roles and what each role can do.</p>
        </div>
      </div>

      <DataState
        query={roles}
        feature="Roles management"
        endpoint="/admin/roles"
        skeletonCount={1}
        emptyState={<RolesReference />}
      >
        {(data) => {
          const list = Array.isArray(data) ? data : [];
          return (
            <div className="grid-auto">
              {list.map((r) => (
                <div key={r.id ?? r.name} className="card card-body">
                  <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <Badge>{r.name ?? r.role ?? 'ROLE'}</Badge>
                    {r.userCount != null ? <span className="muted" style={{ fontSize: '0.82rem' }}>{r.userCount} users</span> : null}
                  </div>
                  {r.description ? <p className="muted" style={{ fontSize: '0.9rem' }}>{r.description}</p> : null}
                </div>
              ))}
            </div>
          );
        }}
      </DataState>

      <RolesReference />
    </div>
  );
}

/** Static reference of the roles defined in the database, always shown. */
function RolesReference() {
  return (
    <div className="card card-pad-lg">
      <div className="row" style={{ marginBottom: '0.9rem' }}>
        <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><Shield size={17} /></span>
        <h2 className="serif" style={{ fontSize: '1.25rem' }}>Role reference</h2>
      </div>
      <div className="grid-auto">
        {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
          <div key={role} className="card card-body" style={{ background: 'var(--surface-2)' }}>
            <Badge variant={role === 'SYSTEM_OWNER' || role === 'ADMIN' ? 'danger' : role === 'PASTOR' || role === 'FINANCE' ? 'warning' : 'neutral'}>{role}</Badge>
            <p className="muted" style={{ fontSize: '0.88rem', marginTop: '0.5rem' }}>{desc}</p>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: '1rem', alignItems: 'flex-start', gap: '0.6rem' }}>
        <Info size={15} style={{ color: 'var(--blue)', marginTop: '0.15rem' }} />
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Role assignment is only available to ADMIN accounts and is re-validated on the server for every action.
        </p>
      </div>
    </div>
  );
}
