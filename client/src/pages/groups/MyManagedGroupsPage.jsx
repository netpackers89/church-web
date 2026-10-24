import { BookOpen, Building2, CalendarDays, FileText, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import DataState from '../../components/ui/DataState.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap } from '../../services/api.js';

export default function MyManagedGroupsPage() {
  const { user } = useAuth();
  const departments = Array.isArray(user?.managedDepartments) ? user.managedDepartments : [];
  const bibleStudyGroups = Array.isArray(user?.managedBibleStudyGroups) ? user.managedBibleStudyGroups : [];
  const managedGroups = [
    ...departments.map((group) => ({ ...group, type: 'department' })),
    ...bibleStudyGroups.map((group) => ({ ...group, type: 'bible_study_group' })),
  ];
  const groupKey = managedGroups.map(({ id, type }) => `${type}:${id}`).join(',');
  const workspaces = useAsync(async () => Promise.all(managedGroups.map(async (group) => {
    const response = await publicService.groupManagementOverview(group.id, group.type);
    return { ...group, ...unwrap(response) };
  })), [user?.id, groupKey]);
  const loadedGroups = Array.isArray(workspaces.data) ? workspaces.data : [];
  const totalMembers = loadedGroups.reduce((total, group) => total + Number(group.members || 0), 0);
  const scheduledGroups = loadedGroups.filter((group) => group.group?.meetingSchedule).length;
  const publishedPosts = loadedGroups.reduce((total, group) => total + Number(group.posts || 0), 0);

  return (
    <div className="stack-lg group-workspace">
      <div className="page-head">
        <div>
          <span className="eyebrow blue">Leadership workspace</span>
          <h1>Manage my groups</h1>
          <p>Review group activity and open the tools for the communities assigned to you.</p>
        </div>
      </div>

      {managedGroups.length ? (
        <>
          <DataState
            query={workspaces}
            feature="Leadership overview"
            endpoint="/groups/:id/management"
            skeletonCount={3}
          >
            {(groups) => (
              <>
                <div className="stat-grid">
                  <SummaryCard icon={<Building2 size={18} />} label="Groups you lead" value={groups.length} />
                  <SummaryCard icon={<Users size={18} />} label="Active members" value={totalMembers} />
                  <SummaryCard icon={<CalendarDays size={18} />} label="Groups with a schedule" value={scheduledGroups} />
                  <SummaryCard icon={<FileText size={18} />} label="Published posts" value={publishedPosts} />
                </div>
                <div className="group-card-grid">
                  {groups.map((group) => {
                    const isDepartment = group.type === 'department';
                    const workspacePath = isDepartment
                      ? `/departments/${group.id}/workspace`
                      : `/bible-study/groups/${group.id}/workspace`;
                    const publicPath = isDepartment
                      ? `/community/departments/${group.id}`
                      : `/community/bible-study-groups/${group.id}`;
                    return (
                      <article className="group-card" key={`${group.type}-${group.id}`}>
                        <div className={`group-card-icon${isDepartment ? '' : ' bible-study-icon'}`}>
                          {isDepartment ? <Building2 size={22} /> : <BookOpen size={22} />}
                        </div>
                        <div className="group-card-title">
                          <div><h2>{group.name}</h2><p>{isDepartment ? 'Department' : 'Bible study group'}</p></div>
                        </div>
                        <p className="group-card-description">{group.group?.description || 'Manage this group’s members, schedule, and updates.'}</p>
                        <dl>
                          <div><dt>Members</dt><dd>{group.members ?? 0}</dd></div>
                          <div><dt>Published posts</dt><dd>{group.posts ?? 0}</dd></div>
                          <div><dt>Meeting schedule</dt><dd>{group.group?.meetingSchedule || 'Not set'}</dd></div>
                          <div><dt>Location</dt><dd>{group.group?.locationText || 'Not set'}</dd></div>
                        </dl>
                        <section className="group-activity">
                          <h3>Recent activity</h3>
                          {group.recentPosts?.length ? (
                            <ul>
                              {group.recentPosts.slice(0, 3).map((post) => (
                                <li key={post.id}><span>{post.title}</span><small>{post.category?.toLowerCase() || post.status?.toLowerCase()}</small></li>
                              ))}
                            </ul>
                          ) : <p className="muted">No group posts yet.</p>}
                        </section>
                        <div className="group-card-actions">
                          <Link className="btn btn-primary btn-sm" to={workspacePath}>Open leadership tools</Link>
                          <Link className="btn btn-secondary btn-sm" to={publicPath}>View group</Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </DataState>
        </>
      ) : (
        <EmptyState
          icon={<Building2 size={30} />}
          title="No groups assigned"
          description="When an administrator assigns you to lead a department or Bible study group, it will appear here."
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span className="stat-icon">{icon}</span></div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-label">{label}</span>
    </div>
  );
}
