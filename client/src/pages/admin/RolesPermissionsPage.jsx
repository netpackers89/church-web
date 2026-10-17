import { useMemo, useState } from 'react';
import { ShieldCheck, KeyRound, Plus, Pencil, Trash2, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/index.js';
import { unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

/* Group permission codes by module so the editor reads like the platform modules. */
function moduleOf(code) {
  if (/^(users|roles|staff|membership|departments)/.test(code)) return 'Members';
  if (/^(events|programs|bible)/.test(code)) return 'Programs';
  if (/^(notifications|announcements|telegram|media|prayer)/.test(code)) return 'Communications';
  if (/^finance/.test(code)) return 'Finance';
  if (/^reports/.test(code)) return 'Reports';
  return 'System';
}

function groupPermissions(list) {
  const groups = new Map();
  for (const permission of list) {
    const module = moduleOf(permission.code);
    if (!groups.has(module)) groups.set(module, []);
    groups.get(module).push(permission);
  }
  return groups;
}

const BLANK_ROLE = { code: '', name: '', description: '', permissionCodes: [] };

export default function RolesPermissionsPage() {
  const { success } = useToast();
  const [tab, setTab] = useState('roles');
  const roles = useAsync(async () => unwrap(await adminService.roles()) ?? [], []);
  const permissionsQuery = useAsync(async () => unwrap(await adminService.listPermissions()) ?? [], []);

  const [modal, setModal] = useState(null); // { mode: 'create'|'edit'|'permissions', role }
  const [form, setForm] = useState(BLANK_ROLE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const permissionGroups = useMemo(() => groupPermissions(permissionsQuery.data ?? []), [permissionsQuery.data]);

  function openCreate() {
    setModal({ mode: 'create' });
    setForm(BLANK_ROLE);
    setError('');
  }

  function openEdit(role) {
    setModal({ mode: 'edit', role });
    setForm({ code: role.code ?? '', name: role.name ?? '', description: role.description ?? '', permissionCodes: (role.permissions ?? []).map((p) => p.code) });
    setError('');
  }

  function openPermissions(role) {
    setModal({ mode: 'permissions', role });
    setForm({ code: role.code ?? '', name: role.name ?? '', description: role.description ?? '', permissionCodes: (role.permissions ?? []).map((p) => p.code) });
    setError('');
  }

  function togglePermission(code) {
    setForm((current) => ({
      ...current,
      permissionCodes: current.permissionCodes.includes(code)
        ? current.permissionCodes.filter((c) => c !== code)
        : [...current.permissionCodes, code],
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      if (modal.mode === 'create') {
        await adminService.createRole({ code: form.code.trim().toUpperCase(), name: form.name.trim(), description: form.description.trim(), permissionCodes: form.permissionCodes });
        success('Role created');
      } else if (modal.mode === 'edit') {
        await adminService.updateRole(modal.role.id, { name: form.name.trim(), description: form.description.trim() });
        success('Role updated');
      } else if (modal.mode === 'permissions') {
        await adminService.setRolePermissions(modal.role.id, { permissionCodes: form.permissionCodes });
        success('Role permissions saved and enforced immediately');
      }
      setModal(null);
      await roles.reload();
    } catch (reason) {
      setError(reason.message || 'Could not save the role.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(role) {
    if (!window.confirm(`Delete the "${role.name || role.code}" role? Users with this role will keep their accounts.`)) return;
    setError('');
    try {
      await adminService.deleteRole(role.id);
      success('Role deleted');
      await roles.reload();
    } catch (reason) {
      setError(reason.message || 'Could not delete the role.');
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="eyebrow blue"><ShieldCheck size={15} /> System</span>
          <h1>Roles &amp; permissions</h1>
          <p>One workspace to view roles, create custom roles, and assign permissions by module. Changes are enforced immediately and re-validated on the server.</p>
        </div>
        <Button iconRight={<Plus size={15} />} onClick={openCreate}>New role</Button>
      </div>

      <div className="directory-tabs" role="tablist" aria-label="Roles and permissions">
        {[['roles', 'Roles'], ['permissions', 'Permission catalog']].map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>
        ))}
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {tab === 'roles' ? (
        <DataState query={roles} feature="Roles" endpoint="/admin/roles" skeletonCount={1}
          emptyState={<EmptyState icon={<ShieldCheck size={30} />} title="No roles yet" description="Create a custom role to get started." action={<Button onClick={openCreate} iconRight={<Plus size={15} />}>Create role</Button>} />}>
          {(list) => (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Role</th><th>Permissions</th><th>Protected</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {list.map((role) => (
                    <tr key={role.id ?? role.code}>
                      <td>
                        <Badge variant={role.code === 'ADMIN' || role.code === 'SYSTEM_OWNER' ? 'danger' : role.code === 'PASTOR' || role.code === 'FINANCE' ? 'warning' : 'neutral'}>{role.name ?? role.code}</Badge>
                        {role.description ? <small className="muted" style={{ display: 'block', marginTop: '0.2rem' }}>{role.description}</small> : null}
                      </td>
                      <td className="muted">{Array.isArray(role.permissions) ? role.permissions.length : 0} granted</td>
                      <td>{role.isSystem ? <Badge variant="warning">System</Badge> : <Badge variant="neutral">Custom</Badge>}</td>
                      <td>
                        <div className="row" style={{ gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <Button size="sm" variant="secondary" iconLeft={<KeyRound size={14} />} onClick={() => openPermissions(role)}>Permissions</Button>
                          <Button size="sm" variant="ghost" iconLeft={<Pencil size={14} />} onClick={() => openEdit(role)}>Edit</Button>
                          {!role.isSystem ? <Button size="sm" variant="ghost" iconLeft={<Trash2 size={14} />} onClick={() => remove(role)}>Delete</Button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      ) : (
        <DataState query={permissionsQuery} feature="Permission catalog" endpoint="/admin/permissions" skeletonCount={1}
          emptyState={<EmptyState icon={<KeyRound size={30} />} title="No permissions found" description="The permission catalog is populated by the server." />}>
          {(list) => (
            <div className="stack-lg">
              {[...groupPermissions(list).entries()].map(([module, items]) => (
                <section className="card card-body" key={module}>
                  <div className="row" style={{ gap: '0.6rem', marginBottom: '0.7rem' }}>
                    <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.2rem', height: '2.2rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)' }}><CheckCircle2 size={16} /></span>
                    <h2 className="serif" style={{ fontSize: '1.1rem' }}>{module}</h2>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Code</th><th>Description</th></tr></thead>
                      <tbody>
                        {items.map((permission) => (
                          <tr key={permission.id ?? permission.code}>
                            <td><code>{permission.code}</code></td>
                            <td className="muted">{permission.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </DataState>
      )}

      <div className="row" style={{ alignItems: 'flex-start', gap: '0.6rem' }}>
        <Info size={15} style={{ color: 'var(--blue)', marginTop: '0.15rem' }} />
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          SYSTEM_OWNER and ADMIN are protected roles and cannot be edited or deleted. You can only grant permissions you yourself hold (unless you are a system owner). Every change is recorded in the audit log.
        </p>
      </div>

      <Modal open={Boolean(modal)} onClose={() => !saving && setModal(null)} title={modal?.mode === 'create' ? 'Create role' : modal?.mode === 'edit' ? 'Edit role' : `Permissions for ${modal?.role?.name ?? modal?.role?.code ?? ''}`} size={modal?.mode === 'permissions' ? 'lg' : 'md'}>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {modal?.mode === 'create' ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="grid-2">
              <Input label="Role code" placeholder="MINISTRY_LEAD" value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value.toUpperCase() }))} required hint="Uppercase letters, numbers, underscores." />
              <Input label="Role name" placeholder="Ministry Lead" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />
            </div>
            <Input label="Description" type="textarea" rows={3} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
            <div className="modal-foot" style={{ padding: '1rem 0 0' }}>
              <Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving} disabled={!form.code.trim() || !form.name.trim()}>Create role</Button>
            </div>
          </form>
        ) : null}
        {modal?.mode === 'edit' ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Input label="Role name" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required />
            <Input label="Description" type="textarea" rows={3} value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
            <div className="modal-foot" style={{ padding: '1rem 0 0' }}>
              <Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving}>Save changes</Button>
            </div>
          </form>
        ) : null}
        {modal?.mode === 'permissions' ? (
          <div className="stack">
            {[...permissionGroups.entries()].map(([module, items]) => (
              <fieldset key={module} style={{ border: '1px solid rgba(15,23,42,0.1)', borderRadius: '0.8rem', padding: '0.9rem' }}>
                <legend style={{ padding: '0 0.4rem', fontWeight: 700 }}>{module}</legend>
                <div className="stack" style={{ gap: '0.4rem' }}>
                  {items.map((permission) => (
                    <label key={permission.id ?? permission.code} className="check-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={form.permissionCodes.includes(permission.code)} onChange={() => togglePermission(permission.code)} />
                      <code>{permission.code}</code>
                      <span className="muted" style={{ fontSize: '0.82rem' }}>{permission.description}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="modal-foot" style={{ padding: '1rem 0 0' }}>
              <Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
              <Button type="button" loading={saving} onClick={save} iconRight={<RefreshCw size={14} />}>Save permissions</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
