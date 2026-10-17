import { Users, CalendarDays, HandHeart, Bell, Shield, ArrowRight, Clock3, Megaphone, CircleDollarSign, UserRoundPlus, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePermissions } from '../../hooks/usePermission.js';
import { adminService, userService, publicService, unwrap } from '../../services/api.js';
import { adminService as messagingAdmin } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import EventCard from '../../components/events/EventCard.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { givingService } from '../../services/index.js';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const perms = usePermissions();

  const members = useAsync(async () => {
    if (!perms.canManageUsers) return null;
    return unwrap(await userService.directory()) ?? [];
  }, [perms.canManageUsers]);

  const events = useAsync(async () => unwrap(await publicService.upcomingEvents({ limit: 3 })) ?? [], []);
  const registrations = useAsync(async () => perms.canManageUsers ? unwrap(await userService.directory()) ?? [] : [], [perms.canManageUsers]);
  const announcements = useAsync(async () => perms.canManageAnnouncements ? unwrap(await adminService.announcements({ limit: 5 })) ?? [] : [], [perms.canManageAnnouncements]);
  const pendingGiving = useAsync(async () => perms.canManageFinance ? unwrap(await givingService.financeQueue({ status: 'PENDING', limit: 5 })) ?? [] : [], [perms.canManageFinance]);
  const newBelievers = useAsync(async () => perms.canManageMembership ? unwrap(await adminService.newChristianFollowups({ limit: 5 })) ?? [] : [], [perms.canManageMembership]);
  const campaigns = useAsync(async () => perms.canViewCampaigns ? unwrap(await givingService.listCampaigns()) ?? [] : [], [perms.canViewCampaigns]);
  const notifications = useAsync(async () => perms.has('notifications.manage') ? unwrap(await messagingAdmin.websiteNotifications({ limit: 5 })) ?? [] : [], [perms.has('notifications.manage')]);

  const memberList = Array.isArray(members.data) ? members.data : [];
  const staffRoles = ['ADMIN', 'PASTOR', 'LEADER', 'FINANCE', 'REGISTRAR'];
  const staffCount = memberList.filter((m) => staffRoles.includes(m.role)).length;
  const activeCount = memberList.filter((m) => (m.accountStatus ?? 'ACTIVE') === 'ACTIVE').length;
  const activeCampaigns = (Array.isArray(campaigns.data) ? campaigns.data : []).filter((c) => (c.displayStatus || c.status) === 'ACTIVE').length;

  const stats = [
    { label: 'Members', value: members.loading ? '…' : memberList.length || '—', icon: Users, to: perms.canManageUsers ? '/admin/members' : null },
    { label: 'Active accounts', value: members.loading ? '…' : activeCount || '—', icon: Shield, to: perms.canManageUsers ? '/admin/members' : null },
    { label: 'Staff & leaders', value: members.loading ? '…' : staffCount || '—', icon: Users, to: perms.canManageUsers ? '/admin/members' : null },
    ...(perms.canManageMembership ? [{ label: 'New believers', value: newBelievers.loading ? '…' : (newBelievers.data?.length ?? '—'), icon: UserRoundPlus, to: '/admin/new-christians' }] : []),
    { label: 'Upcoming events', value: events.loading ? '…' : (events.data?.length ?? '—'), icon: CalendarDays, to: perms.canManageContent ? '/admin/events' : null },
    ...(perms.canManageFinance ? [{ label: 'Pending giving', value: pendingGiving.loading ? '…' : (Array.isArray(pendingGiving.data) ? pendingGiving.data.length : '—'), icon: CircleDollarSign, to: '/admin/giving' }] : []),
    ...(perms.canViewCampaigns ? [{ label: 'Active campaigns', value: campaigns.loading ? '…' : (activeCampaigns || '—'), icon: HandHeart, to: '/admin/campaigns' }] : []),
  ];

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p>Welcome back, {(user?.name || 'Administrator').split(' ')[0]}. Role: {user?.role}</p>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s) => {
          const Icon = s.icon;
          const inner = (
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-icon"><Icon size={18} /></span>
                {s.to ? <ArrowRight size={15} style={{ color: 'var(--muted-2)' }} /> : null}
              </div>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          );
          return s.to ? <Link key={s.label} to={s.to}>{inner}</Link> : <div key={s.label}>{inner}</div>;
        })}
      </div>

      <div className="grid-2 admin-dashboard-workflows" style={{ alignItems: 'flex-start' }}>
        <section>
          <div className="row-between" style={{ marginBottom: '0.8rem' }}>
            <span className="eyebrow blue"><span className="dot" /> Upcoming events</span>
            {perms.canManageContent ? <Button to="/admin/events" variant="ghost" size="sm" iconRight={<ArrowRight size={14} />}>Manage</Button> : null}
          </div>
          {events.loading ? (
            <div className="stack"><div className="card skeleton" style={{ height: '6rem' }} /><div className="card skeleton" style={{ height: '6rem' }} /></div>
          ) : events.data && events.data.length > 0 ? (
            <div className="stack">{events.data.map((e) => <EventCard key={e.id ?? e.title} event={e} />)}</div>
          ) : (
            <div className="card"><p className="muted card-body">No upcoming events.</p></div>
          )}
        </section>

        <section>
          <span className="eyebrow blue" style={{ marginBottom: '0.8rem', display: 'inline-flex' }}><span className="dot" /> Management areas</span>
          <div className="stack">
            {[
              { to: '/admin/members', icon: Users, label: 'Members & staff', show: perms.canManageUsers },
              { to: '/admin/new-christians', icon: UserRoundPlus, label: 'New believers & discipleship', show: perms.canManageMembership },
              { to: '/admin/roles', icon: Shield, label: 'Roles & permissions', show: perms.canManageRoles },
              { to: '/admin/events', icon: CalendarDays, label: 'Events & schedules', show: perms.canManageContent },
              { to: '/admin/campaigns', icon: HandHeart, label: 'Campaigns & giving', show: perms.canViewCampaigns },
              { to: '/admin/announcements', icon: Bell, label: 'Announcements', show: perms.canManageContent },
            ].filter((x) => x.show).map((x) => {
              const Icon = x.icon;
              return (
                <Link key={x.to} to={x.to} className="card card-hover card-body row" style={{ gap: '0.9rem' }}>
                  <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)', flex: 'none' }}><Icon size={17} /></span>
                  <strong style={{ flex: 1 }}>{x.label}</strong>
                  <ArrowRight size={15} style={{ color: 'var(--muted-2)' }} />
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid-3 admin-dashboard-activity">
        {perms.canManageUsers ? <section className="admin-activity-section">
          <div className="row-between"><h2><Clock3 size={17} /> Recent registrations</h2><Button to="/admin/members" variant="ghost" size="sm">View directory</Button></div>
          {registrations.loading ? <p className="muted">Loading registrations…</p> : (Array.isArray(registrations.data) ? registrations.data.slice(0, 5) : []).map((person) => <div className="admin-activity-row" key={person.id}><span><strong>{person.name}</strong><small>{person.email}</small></span><Badge>{person.role || 'MEMBER'}</Badge></div>)}
          {!registrations.loading && !registrations.error && !registrations.data?.length ? <p className="muted">No registrations yet.</p> : null}
        </section> : null}

        {perms.canManageMembership ? <section className="admin-activity-section">
          <div className="row-between"><h2><Activity size={17} /> New believers</h2><Button to="/admin/new-christians" variant="ghost" size="sm">Follow-up</Button></div>
          {newBelievers.loading ? <p className="muted">Loading follow-ups…</p> : (Array.isArray(newBelievers.data) ? newBelievers.data.slice(0, 5) : []).map((record) => <div className="admin-activity-row" key={record.id}><span><strong>{record.fullName || record.name || 'New believer'}</strong><small>{record.phone || record.email || ''}</small></span><Badge variant="warning">{String(record.status ?? 'NEW').replaceAll('_', ' ')}</Badge></div>)}
          {!newBelievers.loading && !newBelievers.error && !newBelievers.data?.length ? <p className="muted">No new-believer follow-ups yet.</p> : null}
        </section> : null}

        {perms.canManageAnnouncements ? <section className="admin-activity-section">
          <div className="row-between"><h2><Megaphone size={17} /> Recent announcements</h2><Button to="/admin/announcements" variant="ghost" size="sm">Manage</Button></div>
          {announcements.loading ? <p className="muted">Loading announcements…</p> : (Array.isArray(announcements.data) ? announcements.data.slice(0, 5) : []).map((item) => <div className="admin-activity-row" key={item.id}><span><strong>{item.title}</strong><small>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Draft'}</small></span><Badge variant={item.status === 'PUBLISHED' ? 'success' : 'neutral'}>{item.status}</Badge></div>)}
          {!announcements.loading && !announcements.error && !announcements.data?.length ? <p className="muted">No announcements yet.</p> : null}
        </section> : null}

        {perms.has('notifications.manage') ? <section className="admin-activity-section">
          <div className="row-between"><h2><Bell size={17} /> Recent notifications</h2><Button to="/admin/notifications" variant="ghost" size="sm">Manage</Button></div>
          {notifications.loading ? <p className="muted">Loading notifications…</p> : (Array.isArray(notifications.data) ? notifications.data.slice(0, 5) : []).map((item) => <div className="admin-activity-row" key={item.id}><span><strong>{item.title}</strong><small>{item.recipientName || 'Member'} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</small></span><Badge variant={item.status === 'SENT' ? 'success' : 'neutral'}>{item.status}</Badge></div>)}
          {!notifications.loading && !notifications.error && !notifications.data?.length ? <p className="muted">No notifications yet.</p> : null}
        </section> : null}

        {perms.canManageFinance ? <section className="admin-activity-section">
          <div className="row-between"><h2><CircleDollarSign size={17} /> Pending giving</h2><Button to="/admin/giving" variant="ghost" size="sm">Approval queue</Button></div>
          {pendingGiving.loading ? <p className="muted">Loading submissions…</p> : (Array.isArray(pendingGiving.data) ? pendingGiving.data.slice(0, 5) : []).map((item) => <div className="admin-activity-row" key={item.id}><span><strong>{item.contributorName || item.userName || 'Contribution'}</strong><small>{item.currency || 'ETB'} {item.amount}</small></span><Badge variant="warning">Pending</Badge></div>)}
          {!pendingGiving.loading && !pendingGiving.error && !pendingGiving.data?.length ? <p className="muted">No pending approvals.</p> : null}
        </section> : null}
      </div>
    </div>
  );
}
