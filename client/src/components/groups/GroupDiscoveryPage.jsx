import { useMemo, useState } from 'react';
import { BookOpen, Building2, Clock3, MapPin, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicService, unwrap } from '../../services/api.js';
import { groupService } from '../../services/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../ui/DataState.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import FollowButton from './FollowButton.jsx';
import ReliableImage from '../ui/ReliableImage.jsx';

const GROUP_TABS = [
  { id: 'department', label: 'Departments' },
  { id: 'bible_study_group', label: 'Bible Study Groups' },
];

export default function GroupDiscoveryPage() {
  const [activeType, setActiveType] = useState('department');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('all');
  const [sort, setSort] = useState('name');
  const { user } = useAuth();
  const groups = useAsync(async () => unwrap(await publicService.groups()) ?? [], []);
  const followed = useAsync(async () => user ? unwrap(await groupService.followed()) ?? [] : [], [user?.id]);

  const followedKeys = useMemo(() => new Set((followed.data ?? []).map((group) => `${group.type}:${group.id}`)), [followed.data]);
  const source = Array.isArray(groups.data) ? groups.data : [];
  const categories = [...new Set(source.filter((group) => group.type === activeType).map((group) => group.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const locations = [...new Set(source.filter((group) => group.type === activeType).map((group) => group.locationText).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const items = source.filter((group) => {
    const haystack = [group.name, group.description, group.leaderName, group.category, group.locationText].join(' ').toLowerCase();
    return group.type === activeType
      && haystack.includes(search.trim().toLowerCase())
      && (category === 'all' || group.category === category)
      && (location === 'all' || group.locationText === location);
  }).sort((a, b) => sort === 'popular'
    ? Number(b.followerCount ?? b.memberCount ?? 0) - Number(a.followerCount ?? a.memberCount ?? 0)
    : String(a.name ?? '').localeCompare(String(b.name ?? '')));

  return (
    <section className="community-discovery" aria-labelledby="community-title">
      <header className="community-discovery-head">
        <div>
          <span className="eyebrow blue"><span className="dot" /> Find your community</span>
          <h1 id="community-title">Grow together</h1>
          <p>Discover a ministry team or Bible study group. Follow a group to keep its posts and program updates close.</p>
        </div>
        {user ? <Link to="/me/groups" className="community-followed-link">My followed groups <span>{followed.data?.length ?? 0}</span></Link> : null}
      </header>

      <div className="community-tabs" role="tablist" aria-label="Community group type">
        {GROUP_TABS.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeType === tab.id} className={activeType === tab.id ? 'active' : ''} onClick={() => { setActiveType(tab.id); setCategory('all'); setLocation('all'); }}>{tab.label}</button>)}
      </div>

      <div className="community-filters">
        <label className="community-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search groups</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search groups, leaders, or places" /></label>
        <label><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Filter by location</span><select value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">All locations</option>{locations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span className="sr-only">Sort groups</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name</option><option value="popular">Most followed</option></select></label>
      </div>

      <DataState query={groups} feature="Community groups" endpoint="/groups" emptyState={<EmptyState icon={<Users size={28} />} title="No groups published yet" description="Public departments and Bible study groups will appear here." />}>
        {() => items.length ? (
          <div className="community-card-grid">
            {items.map((group) => <GroupCard key={`${group.type}:${group.id}`} group={group} isFollowing={followedKeys.has(`${group.type}:${group.id}`)} onFollowChange={() => followed.reload().then(() => groups.reload()).catch(() => {})} />)}
          </div>
        ) : <EmptyState icon={activeType === 'department' ? <Building2 size={28} /> : <BookOpen size={28} />} title={`No ${activeType === 'department' ? 'departments' : 'Bible study groups'} match`} description="Adjust the search or filters, or check back when more groups are published." />}
      </DataState>
    </section>
  );
}

function GroupCard({ group, isFollowing, onFollowChange }) {
  const typeLabel = group.type === 'department' ? 'Department' : 'Bible study';
  const detailPath = `/community/${group.type === 'department' ? 'departments' : 'bible-study-groups'}/${group.id}`;
  return (
    <article className="community-card">
      <Link to={detailPath} className="community-card-cover" aria-label={`View ${group.name}`}>
        {group.bannerUrl || group.logoUrl ? <ReliableImage src={group.bannerUrl || group.logoUrl} alt={`${group.name} cover`} loading="lazy" fallback={<span className="community-cover-placeholder" aria-hidden="true">{group.type === 'department' ? <Building2 size={28} /> : <BookOpen size={28} />}</span>} /> : <span className="community-cover-placeholder" aria-hidden="true">{group.type === 'department' ? <Building2 size={28} /> : <BookOpen size={28} />}</span>}
        <span className="community-card-type">{typeLabel}</span>
      </Link>
      <div className="community-card-body">
        <div className="community-card-heading">
          {group.logoUrl ? <ReliableImage className="community-card-logo" src={group.logoUrl} alt={`${group.name} logo`} loading="lazy" fallback={<span className="community-card-logo community-card-logo-fallback">{group.type === 'department' ? <Building2 size={19} /> : <BookOpen size={19} />}</span>} /> : <span className="community-card-logo community-card-logo-fallback">{group.type === 'department' ? <Building2 size={19} /> : <BookOpen size={19} />}</span>}
          <div><h2><Link to={detailPath}>{group.name}</Link></h2><p>{group.category || typeLabel}</p></div>
        </div>
        <p className="community-card-description">{group.description || 'A community to worship, learn, and serve together.'}</p>
        <div className="community-card-meta">
          <span><Users size={15} aria-hidden="true" />{Number(group.followerCount ?? group.memberCount ?? 0)} following</span>
          {group.locationText ? <span><MapPin size={15} aria-hidden="true" />{group.locationText}</span> : null}
          {group.meetingSchedule ? <span><Clock3 size={15} aria-hidden="true" />{group.meetingSchedule}</span> : null}
        </div>
        {group.leaderName ? <p className="community-card-leader">Led by {group.leaderName}</p> : null}
        {group.recentPostTitle ? <Link className="community-recent-post" to={`${detailPath}#post-${group.recentPostId}`}><span>Latest post</span><strong>{group.recentPostTitle}</strong></Link> : null}
        <div className="community-card-actions"><Link className="btn btn-secondary btn-sm" to={detailPath}>View details</Link><FollowButton groupId={group.id} groupType={group.type} isFollowing={isFollowing} onChange={onFollowChange} /></div>
      </div>
    </article>
  );
}
