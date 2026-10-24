import { BookOpen, MapPin, Pencil, Search, Trash2, Users, Info } from 'lucide-react';
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
import { BibleStudyGroupRegistrationForm } from './RegistrationForms.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';

export default function BibleStudyManagementPage() {
  const { success, error: notifyError } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [visibility, setVisibility] = useState('all');
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const groups = useAsync(async () => unwrap(await adminService.bibleStudyGroups()) ?? [], []);

  async function openDetails(group) {
    setDetails({ ...group, loading: true });
    try {
      const response = await adminService.bibleStudyGroupDetails(group.id);
      setDetails({
        ...response.data?.data,
        loading: false,
        members: response.data?.meta?.members ?? [],
      });
    } catch (error) {
      setDetails({ ...group, loading: false, loadError: error.message || 'Bible study details could not be loaded.' });
    }
  }

  async function toggleStatus(group) {
    try {
      await adminService.updateBibleStudyGroupStatus(group.id, !group.isActive);
      await groups.reload();
      success(`${group.name} ${group.isActive ? 'deactivated' : 'activated'}.`);
    } catch (error) {
      notifyError('Bible study status could not be updated.', error.message);
    }
  }

  async function deleteGroup() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await adminService.deleteBibleStudyGroup(deleteTarget.id);
      await groups.reload();
      success(`${deleteTarget.name} was permanently deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error.message || 'The Bible study group could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  const groupList = Array.isArray(groups.data) ? groups.data : [];
  const filtered = groupList.filter((group) =>
    [group.name, group.description, group.leaderName, group.location, group.meetingSchedule, group.currentStudy].some((value) =>
      String(value ?? '').toLowerCase().includes(search.toLowerCase())
    )
      && (status === 'all' || (status === 'active') === Boolean(group.isActive))
      && (visibility === 'all' || (visibility === 'public') === Boolean(group.isPublic))
  );
  const stats = [
    { icon: <BookOpen size={18} />, label: 'Bible study groups', value: groups.loading ? '—' : groupList.length },
    { icon: <BookOpen size={18} />, label: 'Active groups', value: groups.loading ? '—' : groupList.filter((group) => group.isActive).length },
    { icon: <Users size={18} />, label: 'Members', value: groups.loading ? '—' : groupList.reduce((total, group) => total + Number(group.memberCount || 0), 0) },
    { icon: <Info size={18} />, label: 'Needs a leader', value: groups.loading ? '—' : groupList.filter((group) => !group.leaderUserId && !group.leaderName).length },
  ];

  return (
    <div className="group-workspace stack-lg">
      <div className="workspace-tabs" role="navigation" aria-label="Department and Bible study views">
        <Link to="/admin/departments">Departments</Link>
        <Link to="/admin/bible-study" className="active">Bible Study Groups</Link>
      </div>

      <div className="page-head">
        <div>
          <h1>Bible Study Groups</h1>
          <p>Manage group membership, leaders, meeting locations, and study details.</p>
        </div>
        <Button to="/admin/registrations?type=bible-study-group">Create Bible study group</Button>
      </div>

      <div className="stat-grid">
        {stats.map((stat) => <div className="stat-card" key={stat.label}><div className="stat-top"><span className="stat-icon">{stat.icon}</span></div><strong className="stat-value">{stat.value}</strong><span className="stat-label">{stat.label}</span></div>)}
      </div>

      <div className="workspace-filters">
        <label className="search-field"><Search size={16} /><input type="search" className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search groups, leaders, or locations" /></label>
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Group status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        <select className="select" value={visibility} onChange={(event) => setVisibility(event.target.value)} aria-label="Group visibility"><option value="all">All visibility</option><option value="public">Public</option><option value="private">Private</option></select>
      </div>

      <DataState
        query={groups}
        feature="Bible study groups"
        endpoint="/admin/bible-study-groups"
        emptyState={
          <EmptyState
            icon={<BookOpen size={32} />}
            title="No Bible study groups yet"
            description="Use the registration action to create the first community group."
          />
        }
      >
        {() =>
          filtered.length ? (
            <div className="group-card-grid">
              {filtered.map((group) => (
                <article
                  key={group.id}
                  className="group-card bible-study-admin-card"
                >
                  {group.bannerImage ? <ReliableImage className="group-card-banner" src={group.bannerImage} alt={`${group.name} banner`} /> : null}
                  <div className="group-card-icon bible-study-icon">
                    {group.groupProfileImage ? <ReliableImage src={group.groupProfileImage} alt={`${group.name} logo`} fallback={<BookOpen size={22} />} /> : <BookOpen size={22} />}
                  </div>
                  <div className="group-card-title">
                    <div><h2>{group.name}</h2><p>{group.currentStudy || 'General Bible Study'}</p></div>
                    <Badge variant={group.isActive ? 'success' : 'neutral'}>{group.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="group-card-description">{group.description || 'No description provided for this group.'}</p>
                  <dl>
                    <div><dt>Leader</dt><dd>{group.leaderName || 'Not assigned'}</dd></div>
                    <div><dt>Members</dt><dd>{group.memberCount ?? 0}</dd></div>
                    <div><dt><MapPin size={12} /> Location</dt><dd>{group.locationText || group.location || 'Not set'}</dd></div>
                    <div><dt>Schedule</dt><dd>{group.meetingSchedule || 'Not set'}</dd></div>
                  </dl>
                  <p className="group-telegram-status"><Badge variant={group.telegramConnectionStatus === 'CONNECTED' ? 'success' : 'warning'}>Telegram {group.telegramType === 'none' ? 'not connected' : String(group.telegramConnectionStatus || 'UNVERIFIED').toLowerCase()}</Badge></p>
                  <div className="group-card-actions">
                    <Button to={`/community/bible-study-groups/${group.id}`} size="sm" variant="secondary" iconLeft={<Users size={14} />}>View group</Button>
                      <MoreActionsMenu actions={[
                        { label: 'View details', icon: <Info size={15} />, onClick: () => openDetails(group) },
                        { label: 'Edit group', icon: <Pencil size={15} />, onClick: () => setEditing(group) },
                        { label: group.isActive ? 'Deactivate group' : 'Activate group', icon: <BookOpen size={15} />, onClick: () => toggleStatus(group) },
                        { label: 'Delete group', icon: <Trash2 size={15} />, danger: true, onClick: () => { setDeleteError(''); setDeleteTarget(group); } },
                      ]} />
                      <CommunityLinksManager
                        groupName={group.name}
                        links={group.communityLinks}
                        onSave={async (communityLinks) => {
                          await adminService.updateBibleStudyCommunityLinks(group.id, communityLinks);
                          await groups.reload();
                        }}
                      />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Search size={28} />} title="No matching groups found" description="Try refining your search terms or filter keywords." />
          )
        }
      </DataState>

      <Modal open={Boolean(details)} onClose={() => setDetails(null)} title={details?.name || 'Bible study group details'} size="lg">
        {details ? (
          <div className="stack">
            {details.loadError ? <Alert variant="danger">{details.loadError}</Alert> : null}
            {details.loading ? <p role="status">Loading Bible study details…</p> : null}
            {details.bannerImage ? <ReliableImage className="group-detail-banner" src={details.bannerImage} alt={`${details.name} banner`} /> : null}
            <p>{details.description || 'No description has been added.'}</p>
            <dl className="group-detail-list">
              <div><dt>Current study</dt><dd>{details.currentStudy || 'General Bible Study'}</dd></div>
              <div><dt>Facilitator</dt><dd>{details.leaderName || 'Not assigned'}</dd></div>
              <div><dt>Location</dt><dd>{details.locationText || details.location || 'Location TBD'}</dd></div>
              <div><dt>Schedule</dt><dd>{details.meetingSchedule || 'Not set'}</dd></div>
              <div><dt>Capacity</dt><dd>{details.capacity || 'Not specified'}</dd></div>
              <div><dt>Visibility</dt><dd>{details.isPublic ? 'Public' : 'Private'}</dd></div>
              <div><dt>Telegram</dt><dd>{details.telegramType === 'none' ? 'Not connected' : details.telegramConnectionStatus || 'Unverified'}</dd></div>
              <div><dt>Members</dt><dd>{details.memberCount ?? details.members?.length ?? 0}</dd></div>
            </dl>
            {details.communityLinks?.length ? <section><h3>Community links</h3><ul>{details.communityLinks.map((link) => <li key={`${link.platform}-${link.url}`}><a href={link.url} target="_blank" rel="noreferrer">{link.label || link.platform}</a></li>)}</ul></section> : null}
            {!details.loading ? <section className="stack-sm"><h3>Members</h3>{details.members?.length ? <ul className="group-member-list">{details.members.map((member) => <li key={member.id}><span><strong>{member.name}</strong><small>{member.email || 'No email on file'}</small></span><Badge variant="neutral">{member.memberRole || 'MEMBER'}</Badge></li>)}</ul> : <p className="muted">No active members are assigned to this group.</p>}</section> : null}
            <div className="modal-foot"><Button variant="secondary" onClick={() => setDetails(null)}>Close</Button><Button disabled={details.loading} onClick={() => { setEditing(details); setDetails(null); }}>Edit group</Button></div>
          </div>
        ) : null}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit Bible study group ${editing ? `· ${editing.name}` : ''}`}
        description="Changes will instantly update the live group details and its records."
        size="lg"
      >
        {editing ? (
          <BibleStudyGroupRegistrationForm
            key={editing.id}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              await groups.reload();
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Permanently delete Bible study group?"
        description="This action is final and cannot be undone."
      >
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
          {deleteError ? <Alert variant="danger">{deleteError}</Alert> : null}
          <p>
            You are about to delete <strong className="text-gray-900 dark:text-white">{deleteTarget?.name}</strong>. All associated group-only data will be permanently removed, including memberships, join requests, active discussion posts, comments, notifications, and custom programs.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Note: Global church events, user core profiles, donations, and shared media files remain untouched.
          </p>
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteGroup} loading={deleting}>
              Yes, delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}