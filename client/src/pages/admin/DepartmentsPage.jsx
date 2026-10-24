import { Building2, Search, Users, Pencil, Trash2, Info } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import CommunityLinksManager from '../../components/groups/CommunityLinksManager.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Alert from '../../components/ui/Alert.jsx';
import MoreActionsMenu from '../../components/ui/MoreActionsMenu.jsx';
import { DepartmentRegistrationForm } from './RegistrationForms.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';

export default function DepartmentsPage() {
  const { success, error: notifyError } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const departments = useAsync(async () => unwrap(await adminService.departments()) ?? [], []);
  async function deleteDepartment() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminService.deleteDepartment(deleteTarget.id);
      await departments.reload();
      success(`${deleteTarget.name} was permanently deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error.message || 'The department could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }
  async function openDetails(department) {
    setDetails({ ...department, loading: true });
    try {
      const response = await adminService.departmentDetails(department.id);
      setDetails({
        ...response.data?.data,
        loading: false,
        members: response.data?.meta?.members ?? [],
      });
    } catch (error) {
      setDetails({ ...department, loading: false, loadError: error.message || 'Department details could not be loaded.' });
    }
  }
  async function toggleStatus(department) {
    try {
      await adminService.updateDepartmentStatus(department.id, !department.isActive);
      await departments.reload();
      success(`${department.name} ${department.isActive ? 'deactivated' : 'activated'}.`);
    } catch (error) {
      notifyError('Department status could not be updated.', error.message);
    }
  }
  const departmentList = Array.isArray(departments.data) ? departments.data : [];
  const categories = [...new Set(departmentList.map((department) => department.category).filter(Boolean))].sort();
  const filtered = departmentList.filter((department) => {
    const matchesSearch = [department.name, department.description, department.category, department.leaderName].some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase()));
    return matchesSearch
      && (status === 'all' || (status === 'active') === Boolean(department.isActive))
      && (category === 'all' || department.category === category);
  });
  const stats = [
    { icon: <Building2 size={18} />, label: 'Departments', value: departments.loading ? '—' : departmentList.length },
    { icon: <Users size={18} />, label: 'Active departments', value: departments.loading ? '—' : departmentList.filter((department) => department.isActive).length },
    { icon: <Users size={18} />, label: 'Members', value: departments.loading ? '—' : departmentList.reduce((total, department) => total + Number(department.memberCount || 0), 0) },
    { icon: <Info size={18} />, label: 'Needs a leader', value: departments.loading ? '—' : departmentList.filter((department) => !department.leaderUserId && !department.leaderName).length },
  ];
  return <div className="stack-lg group-workspace">
    <div className="workspace-tabs" role="navigation" aria-label="Department and Bible study views"><Link className="active" to="/admin/departments">Departments</Link><Link to="/admin/bible-study">Bible Study Groups</Link></div>
    <div className="page-head"><div><h1>Departments</h1><p>Organize ministry teams, leaders, and their church-wide work.</p></div><Button to="/admin/registrations?type=department">Create department</Button></div>
    <div className="stat-grid">{stats.map((stat) => <div className="stat-card" key={stat.label}><div className="stat-top"><span className="stat-icon">{stat.icon}</span></div><strong className="stat-value">{stat.value}</strong><span className="stat-label">{stat.label}</span></div>)}</div>
    <div className="workspace-filters">
      <label className="search-field"><Search size={16} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments" /></label>
      <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Department status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select className="select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Department category"><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    </div>
    <DataState query={departments} feature="Departments" endpoint="/admin/departments" emptyState={<EmptyState icon={<Building2 size={30} />} title="No departments yet" description="Use the registration action to create the first department." />}>
      {() => filtered.length ? <div className="group-card-grid">{filtered.map((department) => <article className="group-card" key={department.id}>
        {department.bannerUrl ? <ReliableImage className="group-card-banner" src={department.bannerUrl} alt={`${department.name} banner`} /> : null}
        <div className="group-card-icon">{department.logoUrl ? <ReliableImage src={department.logoUrl} alt={`${department.name} logo`} fallback={<Building2 size={22} />} /> : <Building2 size={22} />}</div>
        <div className="group-card-title"><div><h2>{department.name}</h2><p>{department.category || 'Church department'}</p></div><Badge variant={department.isActive ? 'success' : 'neutral'}>{department.isActive ? 'Active' : 'Inactive'}</Badge></div>
        <p className="group-card-description">{department.description || 'No department description has been added.'}</p>
        <dl><div><dt>Leader</dt><dd>{department.leaderName || 'Not assigned'}</dd></div><div><dt>Members</dt><dd>{department.memberCount ?? 0}</dd></div><div><dt>Organization</dt><dd>{department.organizationName || 'Independent'}</dd></div><div><dt>Location</dt><dd>{department.meetingLocation || 'Not set'}</dd></div><div><dt>Schedule</dt><dd>{department.meetingSchedule || 'Not set'}</dd></div></dl>
        <p className="group-telegram-status"><Badge variant={department.telegramConnectionStatus === 'CONNECTED' ? 'success' : 'warning'}>Telegram {department.telegramType === 'none' ? 'not connected' : String(department.telegramConnectionStatus || 'UNVERIFIED').toLowerCase()}</Badge></p>
        <div className="group-card-actions">
          <Button to={`/me/departments/${department.id}`} size="sm" variant="secondary" iconLeft={<Users size={14} />}>View workspace</Button>
          <MoreActionsMenu actions={[
            { label: 'View details', icon: <Info size={15} />, onClick: () => openDetails(department) },
            { label: 'Edit department', icon: <Pencil size={15} />, onClick: () => setEditing(department) },
            { label: department.isActive ? 'Deactivate department' : 'Activate department', icon: <Building2 size={15} />, onClick: () => toggleStatus(department) },
            { label: 'Delete department', icon: <Trash2 size={15} />, danger: true, onClick: () => { setDeleteError(''); setDeleteTarget(department); } },
          ]} />
          <CommunityLinksManager groupName={department.name} links={department.communityLinks} onSave={async (communityLinks) => { await adminService.updateDepartmentCommunityLinks(department.id, communityLinks); await departments.reload(); }} />
        </div>
      </article>)}</div> : <EmptyState icon={<Search size={25} />} title="No matching departments" description="Try another search or status filter." />}
    </DataState>
    <Modal open={Boolean(details)} onClose={() => setDetails(null)} title={details?.name || 'Department details'} size="lg">
      {details ? <div className="stack">
        {details.loadError ? <Alert variant="danger">{details.loadError}</Alert> : null}
        {details.loading ? <p role="status">Loading department details…</p> : null}
        {details.bannerUrl ? <ReliableImage className="group-detail-banner" src={details.bannerUrl} alt={`${details.name} banner`} /> : null}
        <p>{details.description || 'No department description has been added.'}</p>
        <dl className="group-detail-list">
          <div><dt>Category</dt><dd>{details.category || 'Church department'}</dd></div>
          <div><dt>Leader</dt><dd>{details.leaderName || 'Not assigned'}</dd></div>
          <div><dt>Organization</dt><dd>{details.organizationName || 'Independent'}</dd></div>
          <div><dt>Location</dt><dd>{details.meetingLocation || 'Not set'}</dd></div>
          <div><dt>Schedule</dt><dd>{details.meetingSchedule || 'Not set'}</dd></div>
          <div><dt>Visibility</dt><dd>{details.visibility || 'PUBLIC'}</dd></div>
          <div><dt>Telegram</dt><dd>{details.telegramType === 'none' ? 'Not connected' : details.telegramConnectionStatus || 'Unverified'}</dd></div>
          <div><dt>Members</dt><dd>{details.memberCount ?? details.members?.length ?? 0}</dd></div>
        </dl>
        {details.communityLinks?.length ? <section><h3>Community links</h3><ul>{details.communityLinks.map((link) => <li key={`${link.platform}-${link.url}`}><a href={link.url} target="_blank" rel="noreferrer">{link.label || link.platform}</a></li>)}</ul></section> : null}
        {!details.loading ? <section className="stack-sm"><h3>Members</h3>{details.members?.length ? <ul className="group-member-list">{details.members.map((member) => <li key={member.id}><span><strong>{member.name}</strong><small>{member.email || 'No email on file'}</small></span><Badge variant="neutral">{member.memberRole || 'MEMBER'}</Badge></li>)}</ul> : <p className="muted">No active members are assigned to this department.</p>}</section> : null}
        <div className="modal-foot"><Button variant="secondary" onClick={() => setDetails(null)}>Close</Button><Button disabled={details.loading} onClick={() => { setEditing(details); setDetails(null); }}>Edit department</Button></div>
      </div> : null}
    </Modal>
    <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit department${editing ? ` · ${editing.name}` : ''}`} description="Changes update the live department record and its assigned leader." size="lg">
      {editing ? <DepartmentRegistrationForm key={editing.id} initialValue={editing} onCancel={() => setEditing(null)} onSaved={async () => { await departments.reload(); setEditing(null); }} /> : null}
    </Modal>
    <Modal open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} title="Permanently delete department?" description="This action cannot be undone.">
      {deleteError ? <Alert variant="danger">{deleteError}</Alert> : null}
      <p><strong>{deleteTarget?.name}</strong> and its department-only data will be permanently deleted, including memberships and leader assignment, join requests, posts and attached references, likes, comments, notification subscriptions and delivery records, and department programs.</p>
      <p>Events used by the whole church are preserved. Donations, user accounts, audit/legal records, and media that may be shared are not deleted. Group-only events and their registrations will be removed.</p>
      <div className="modal-foot"><Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button><Button variant="danger" onClick={deleteDepartment} loading={deleting}>Delete department permanently</Button></div>
    </Modal>
  </div>;
}
