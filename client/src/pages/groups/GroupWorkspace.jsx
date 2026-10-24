import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Building2, CalendarDays, ExternalLink, FileText, MapPin, Share2, Users } from 'lucide-react';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { canAccessWorkspace } from '../../app/authNavigation.js';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import FollowButton from '../../components/groups/FollowButton.jsx';
import GroupPostCard from '../../components/groups/GroupPostCard.jsx';
import NotificationPreferences from '../../components/groups/NotificationPreferences.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';

const TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'programs', label: 'Programs' },
  { id: 'about', label: 'About' },
];

export default function GroupWorkspace() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { success } = useToast();
  const groupType = pathname.includes('departments') ? 'department' : 'bible_study_group';
  const [activeTab, setActiveTab] = useState('posts');
  const [showPrefs, setShowPrefs] = useState(false);
  const group = useAsync(async () => unwrap(await publicService.group(id, groupType)), [id, groupType]);
  const followStatus = useAsync(async () => user ? unwrap(await publicService.groupFollowStatus(id, groupType)) : { isFollowing: false }, [id, groupType, user?.id]);
  const posts = useAsync(async () => unwrap(await publicService.groupPosts(id, groupType)) ?? [], [id, groupType]);
  const programs = useAsync(async () => unwrap(await publicService.groupPrograms(id, groupType)) ?? [], [id, groupType]);

  const following = Boolean(followStatus.data?.isFollowing);
  const g = group.data;
  const loading = group.loading || posts.loading || (Boolean(user) && followStatus.loading);
  const managerKind = groupType === 'department' ? 'department' : 'bible-study';
  const canManage = Boolean(user && canAccessWorkspace(user, managerKind, id));
  const detailHome = user ? '/me/community' : '/community';

  if (loading) return <div className="group-page-loading" role="status">Loading group…</div>;
  if (group.error || !g) return <div className="group-page-error"><h1>Group not available</h1><p>{group.error?.message || 'This group may be private or no longer published.'}</p><Button to={detailHome} variant="secondary">Back to community</Button></div>;

  const managePath = groupType === 'department' ? `/departments/${id}/workspace` : `/bible-study/groups/${id}/workspace`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: g.name, text: g.description, url: window.location.href });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(window.location.href); success('Group link copied.'); }
    } catch (error) { if (error.name !== 'AbortError') console.error('Unable to share group link:', error); }
  };

  return (
    <div className="group-detail-page">
      <Link to={detailHome} className="group-back-link"><ArrowLeft size={16} /> Community</Link>
      <header className="group-detail-hero">
        {g.bannerUrl ? <ReliableImage className="group-detail-cover" src={g.bannerUrl} alt={`${g.name} banner`} fallback={<div className="group-detail-cover group-detail-cover-empty" />} /> : <div className="group-detail-cover group-detail-cover-empty" />}
        <div className="group-detail-profile">
          {g.logoUrl ? <ReliableImage className="group-detail-logo" src={g.logoUrl} alt={`${g.name} logo`} fallback={<span className="group-detail-logo group-detail-logo-fallback">{groupType === 'department' ? <Building2 /> : <BookOpen />}</span>} /> : <span className="group-detail-logo group-detail-logo-fallback">{groupType === 'department' ? <Building2 /> : <BookOpen />}</span>}
          <div className="group-detail-main">
            <span className="eyebrow blue">{groupType === 'department' ? 'Department' : 'Bible study group'}{g.category ? ` · ${g.category}` : ''}</span>
            <h1>{g.name}</h1>
            <p>{g.description || 'A community to worship, learn, and serve together.'}</p>
            <div className="group-detail-meta"><span><Users size={16} />{Number(g.followerCount ?? g.memberCount ?? 0)} following</span>{g.locationText ? <span><MapPin size={16} />{g.locationText}</span> : null}{g.meetingSchedule ? <span><CalendarDays size={16} />{g.meetingSchedule}</span> : null}</div>
            {g.leaderName ? <p className="group-leader-name">Led by {g.leaderName}</p> : null}
          </div>
          <div className="group-detail-actions">
            <FollowButton groupId={id} groupType={groupType} isFollowing={following} onChange={() => followStatus.reload()} />
            {user && following ? <Button variant="secondary" size="sm" onClick={() => setShowPrefs(true)}>Notifications</Button> : null}
            <Button variant="outline" size="sm" onClick={share}><Share2 size={15} /> Share</Button>
            {canManage ? <Button to={managePath} variant="secondary" size="sm">Manage group</Button> : null}
          </div>
        </div>
      </header>

      <nav className="group-detail-tabs" aria-label="Group sections" role="tablist">
        {TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
      </nav>

      <div className="group-detail-content">
        {activeTab === 'posts' ? <section className="group-feed" aria-label="Group posts">
          <div className="group-feed-heading"><div><span className="eyebrow blue">Community feed</span><h2>Latest posts</h2></div></div>
          <DataState query={posts} feature="Group posts" endpoint={`/groups/${id}/posts`} emptyState={<EmptyState icon={<FileText size={28} />} title="No posts yet" description="Group announcements and stories will appear here." />}>
            {(list) => <div className="group-post-list">{list.map((post) => <GroupPostCard key={post.id} post={post} groupId={id} groupType={groupType} canManage={canManage} />)}</div>}
          </DataState>
        </section> : null}
        {activeTab === 'programs' ? <section className="group-section-panel"><span className="eyebrow blue">Gather together</span><h2>Programs and gatherings</h2>
          {g.meetingSchedule ? <article className="group-program-preview"><CalendarDays size={20} /><div><strong>Regular gathering</strong><p>{g.meetingSchedule}{g.locationText ? ` · ${g.locationText}` : ''}</p></div></article> : null}
          <DataState query={programs} feature="Group programs" endpoint={`/groups/${id}/programs`} emptyState={<p className="muted">No upcoming group-specific programs have been published yet.</p>}>{(events) => events.length ? <div className="group-event-list">{events.map((event) => <article className="group-event-card" key={event.id}>{event.imageUrl ? <ReliableImage src={event.imageUrl} alt="" fallback={<CalendarDays size={20} />} /> : <CalendarDays size={20} />}<div><span>{new Date(event.startsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><h3>{event.title}</h3>{event.description ? <p>{event.description}</p> : null}{event.locationText ? <small>{event.locationText}</small> : null}</div><Button to={`/events/${event.id}`} variant="secondary" size="sm">Details</Button></article>)}</div> : <p className="muted">No upcoming group-specific programs have been published yet.</p>}</DataState>
          <Button to="/programs" variant="secondary" size="sm">Browse all church programs</Button>
        </section> : null}
        {activeTab === 'about' ? <section className="group-section-panel"><span className="eyebrow blue">Get to know us</span><h2>About {g.name}</h2><p>{g.description || 'A community to worship, learn, and serve together.'}</p>
          {groupType === 'bible_study_group' && g.currentStudy ? <article className="group-about-study"><BookOpen size={19} /><div><strong>Current study</strong><p>{g.currentStudy}</p></div></article> : null}
          {g.locationText ? <article className="group-about-study"><MapPin size={19} /><div><strong>Where we meet</strong><p>{g.locationText}</p></div></article> : null}
          {g.meetingSchedule ? <article className="group-about-study"><CalendarDays size={19} /><div><strong>Gathering schedule</strong><p>{g.meetingSchedule}</p></div></article> : null}
          {g.communityLinks?.length ? <div className="group-external-links"><h3>Connect with this group</h3>{g.communityLinks.map((link) => <a key={`${link.platform}:${link.url}`} href={link.url} target="_blank" rel="noreferrer"><ExternalLink size={15} />{link.label}</a>)}</div> : null}
        </section> : null}
      </div>

      <Modal open={showPrefs} onClose={() => setShowPrefs(false)} title="Notification preferences" description="Choose how updates from this group reach you.">
        <NotificationPreferences groupId={id} groupType={groupType} onSave={() => setShowPrefs(false)} />
      </Modal>
    </div>
  );
}
