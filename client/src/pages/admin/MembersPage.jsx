import { Users, Search, UserCog } from 'lucide-react';
import { useState } from 'react';
import { adminService as adminApi, userService, unwrap } from '../../services/api.js';
import { adminService as directoryAdmin } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { usePermissions } from '../../hooks/usePermission.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ProfileAvatar from '../../components/ui/ProfileAvatar.jsx';

const ROLE_TONE = { ADMIN: 'danger', PASTOR: 'warning', FINANCE: 'warning', LEADER: 'neutral', REGISTRAR: 'neutral', MEMBER: 'neutral' };
const STAFF_ROLES = ['ADMIN', 'SYSTEM_OWNER', 'PASTOR', 'LEADER', 'FINANCE', 'REGISTRAR', 'STAFF'];

export default function MembersPage() {
  const perms = usePermissions();
  const { user } = useAuth();
  const { success } = useToast();
  const [search, setSearch] = useState('');
  const [directoryTab, setDirectoryTab] = useState('all');
  const [busy, setBusy] = useState({});
  const [retryError, setRetryError] = useState('');
  const [roleModal, setRoleModal] = useState(null); // { member, selected: [] }
  const [statusTarget, setStatusTarget] = useState(null);
  const [savingRoles, setSavingRoles] = useState(false);
  const members = useAsync(async () => unwrap(await userService.directory()) ?? [], []);
  const roles = useAsync(async () => perms.has('roles.manage') ? unwrap(await directoryAdmin.roles()) ?? [] : [], [perms.has('roles.manage')]);
  const canRetryWelcome = perms.has('users.manage');
  const canManageUsers = perms.has('users.manage');
  const canManageRoles = perms.has('roles.manage');
  const isSystemOwner = user?.role === 'SYSTEM_OWNER';
  const canGrantAdmin = canManageRoles && (isSystemOwner || user?.role === 'ADMIN');

  async function retryWelcome(member, channel) {
    const key = `${member.id}-${channel}`;
    setBusy((state) => ({ ...state, [key]: true }));
    setRetryError('');
    try {
      await adminApi.retryMemberWelcome(member.id, channel);
      await members.reload();
      success(`${channel === 'email' ? 'Email' : 'Telegram'} welcome delivered`);
    } catch (error) {
      setRetryError(error.message || `Could not retry ${channel} welcome delivery.`);
      await members.reload();
    } finally {
      setBusy((state) => ({ ...state, [key]: false }));
    }
  }

  function openRoleModal(member) {
    setRoleModal({ member, selected: [member.role || 'MEMBER'].filter(Boolean) });
  }

  function toggleRole(code) {
    setRoleModal((current) => ({
      ...current,
      selected: current.selected.includes(code) ? current.selected.filter((c) => c !== code) : [...current.selected, code],
    }));
  }

  async function saveRoles() {
    setSavingRoles(true);
    setRetryError('');
    try {
      await directoryAdmin.assignRole(roleModal.member.id, { roles: roleModal.selected, reason: 'Updated from the member directory.' });
      success('Roles updated and enforced immediately');
      setRoleModal(null);
      await members.reload();
    } catch (error) {
      setRetryError(error.message || 'Could not update roles.');
    } finally {
      setSavingRoles(false);
    }
  }

  async function saveStatus() {
    if (!statusTarget) return;
    const member = statusTarget;
    const status = (member.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    setBusy((state) => ({ ...state, [`${member.id}-status`]: true }));
    setRetryError('');
    try {
      await directoryAdmin.updateUserStatus(member.id, { status });
      success(status === 'ACTIVE' ? 'Account reactivated' : 'Account deactivated');
      setStatusTarget(null);
      await members.reload();
    } catch (error) {
      setRetryError(error.message || 'Could not update the account status.');
    } finally {
      setBusy((state) => ({ ...state, [`${member.id}-status`]: false }));
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Members &amp; staff</h1>
          <p>Search registered people and switch between members and staff without changing their existing roles.</p>
        </div>
        <div className="page-actions" style={{ position: 'relative', minWidth: '16rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.3rem' }}
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search members"
          />
        </div>
      </div>

      {retryError ? <Alert variant="danger">{retryError}</Alert> : null}

      <div className="directory-tabs" role="tablist" aria-label="People directory filter">
        {[['all', 'All people'], ['members', 'Members'], ['staff', 'Staff']].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={directoryTab === value} className={directoryTab === value ? 'active' : ''} onClick={() => setDirectoryTab(value)}>{label}</button>)}
      </div>

      <DataState
        query={members}
        feature="Member directory"
        endpoint="/users"
        skeletonCount={1}
        emptyState={<EmptyState icon={<Users size={30} />} title="No members yet" description="Registered members will appear here." />}
      >
        {(data) => {
          const list = (Array.isArray(data) ? data : []).filter((m) => {
            const isStaff = STAFF_ROLES.includes(String(m.role || '').toUpperCase());
            if (directoryTab === 'members' && isStaff) return false;
            if (directoryTab === 'staff' && !isStaff) return false;
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return [m.name, m.email, m.phone, m.role].some((v) => (v ?? '').toString().toLowerCase().includes(q));
          });
          return (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Person</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Welcome delivery</th><th /></tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id ?? m.email}>
                      <td>
                        <div className="row" style={{ gap: '0.6rem', alignItems: 'center' }}>
                          <ProfileAvatar src={m.profileImageUrl} name={m.name} alt={`${m.name || 'Member'} profile picture`}
                            imageClassName="brand-mark" fallbackClassName="brand-mark"
                            style={{ width: '2.2rem', height: '2.2rem', fontSize: '0.8rem', flex: 'none', objectFit: 'cover' }} />
                          <strong>{m.name}</strong>
                        </div>
                      </td>
                      <td className="muted">{m.email}</td>
                      <td className="muted">{m.phone ?? '—'}</td>
                      <td><Badge variant={ROLE_TONE[m.role] ?? 'neutral'}>{m.role ?? 'MEMBER'}</Badge></td>
                      <td><Badge variant={(m.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'success' : 'warning'}>{m.accountStatus ?? 'ACTIVE'}</Badge></td>
                      <td>
                        <WelcomeDeliveryStatus label="Email" status={m.welcomeEmailStatus} />
                        {canRetryWelcome && m.welcomeEmailStatus === 'FAILED' ? <Button size="sm" variant="ghost" loading={Boolean(busy[`${m.id}-email`])} onClick={() => retryWelcome(m, 'email')}>Retry email</Button> : null}
                        <WelcomeDeliveryStatus label="Telegram" status={m.welcomeTelegramStatus} />
                        {canRetryWelcome && m.welcomeTelegramStatus === 'FAILED' ? <Button size="sm" variant="ghost" loading={Boolean(busy[`${m.id}-telegram`])} onClick={() => retryWelcome(m, 'telegram')}>Retry Telegram</Button> : null}
                      </td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.4rem' }}>
                          {canManageRoles && (isSystemOwner || m.role !== 'ADMIN') ? <Button size="sm" variant="secondary" iconLeft={<UserCog size={14} />} onClick={() => openRoleModal(m)}>Roles</Button> : null}
                          {canManageUsers ? (
                            <Button
                              size="sm"
                              variant={(m.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'ghost' : 'secondary'}
                              disabled={String(m.id) === String(user?.id) || Boolean(busy[`${m.id}-status`])}
                              loading={Boolean(busy[`${m.id}-status`])}
                              onClick={() => setStatusTarget(m)}
                            >
                              {(m.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 ? (
                    <tr><td colSpan={7}><p className="muted center" style={{ padding: '1rem' }}>No people match the selected filter.</p></td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          );
        }}
      </DataState>

      <Modal open={Boolean(roleModal)} onClose={() => !savingRoles && setRoleModal(null)} title={`Manage roles — ${roleModal?.member?.name ?? ''}`}>
        <div className="stack">
          <p className="muted">Assign one or more roles. Changes are enforced immediately and re-validated on the server.</p>
          {roles.data?.filter((r) => r.code !== 'SYSTEM_OWNER' && (r.code !== 'ADMIN' || canGrantAdmin)).map((role) => (
            <label key={role.id ?? role.code} className="check-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={roleModal?.selected.includes(role.code)} onChange={() => toggleRole(role.code)} />
              <strong>{role.name || role.code}</strong>
              {role.description ? <span className="muted" style={{ fontSize: '0.82rem' }}>{role.description}</span> : null}
            </label>
          ))}
          <div className="modal-foot" style={{ padding: '1rem 0 0' }}>
            <Button type="button" variant="secondary" onClick={() => setRoleModal(null)} disabled={savingRoles}>Cancel</Button>
            <Button type="button" loading={savingRoles} onClick={saveRoles} disabled={!roleModal?.selected.length}>Save roles</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(statusTarget)}
        onClose={() => !busy[`${statusTarget?.id}-status`] && setStatusTarget(null)}
        title={(statusTarget?.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'Deactivate account?' : 'Reactivate account?'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setStatusTarget(null)} disabled={Boolean(busy[`${statusTarget?.id}-status`])}>Cancel</Button>
            <Button
              type="button"
              variant={(statusTarget?.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'danger' : 'primary'}
              loading={Boolean(busy[`${statusTarget?.id}-status`])}
              onClick={saveStatus}
            >
              {(statusTarget?.accountStatus ?? 'ACTIVE') === 'ACTIVE' ? 'Deactivate account' : 'Reactivate account'}
            </Button>
          </>
        }
      >
        <p className="muted">
          {(statusTarget?.accountStatus ?? 'ACTIVE') === 'ACTIVE'
            ? `Deactivating ${statusTarget?.name || 'this account'} will block sign-in and end active sessions.`
            : `Reactivating ${statusTarget?.name || 'this account'} will restore their ability to sign in.`}
        </p>
      </Modal>
    </div>
  );
}

function WelcomeDeliveryStatus({ label, status }) {
  const variant = status === 'DELIVERED' ? 'success' : status === 'FAILED' ? 'danger' : 'neutral';
  const text = status ? status.toLowerCase() : 'not sent';
  return <div className="followup-delivery"><span>{label}</span><Badge variant={variant}>{text}</Badge></div>;
}
