import { useMemo, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, ChevronLeft, ChevronRight, Users, UserRoundPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminService, publicService, unwrap, userService } from '../../services/api.js';
import { usePermissions } from '../../hooks/usePermission.js';
import useAsync from '../../hooks/useAsync.js';
import EventCard from '../../components/events/EventCard.jsx';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const PAGE_SIZE = 5;

export default function AdminDashboardPage() {
  const perms = usePermissions();
  const [departmentPage, setDepartmentPage] = useState(0);
  const members = useAsync(async () => perms.canManageUsers ? unwrap(await userService.directory()) ?? [] : [], [perms.canManageUsers]);
  const newChristians = useAsync(async () => {
    if (!perms.canManageMembership) return [];
    const response = unwrap(await adminService.newChristianFollowups({ limit: 100 }));
    return response?.items ?? response ?? [];
  }, [perms.canManageMembership]);
  const departments = useAsync(async () => perms.has('staff.manage') ? unwrap(await adminService.departments()) ?? [] : [], [perms.has('staff.manage')]);
  const events = useAsync(async () => unwrap(await publicService.upcomingEvents({ limit: 6 })) ?? [], []);
  const memberList = Array.isArray(members.data) ? members.data : [];
  const believerList = Array.isArray(newChristians.data) ? newChristians.data : [];
  const departmentList = Array.isArray(departments.data) ? departments.data : [];
  const totalDepartmentPages = Math.max(1, Math.ceil(departmentList.length / PAGE_SIZE));
  const visibleDepartments = departmentList.slice(departmentPage * PAGE_SIZE, departmentPage * PAGE_SIZE + PAGE_SIZE);
  const trend = useMemo(() => membershipTrend(Array.isArray(members.data) ? members.data : []), [members.data]);

  return <div className="stack-lg admin-overview">
    <div className="page-head">
      <div><h1>Church overview</h1><p>Membership, discipleship, departments, and upcoming gatherings in one place.</p></div>
    </div>

    <div className="admin-summary-grid">
      <SummaryCard label="Total members" value={!perms.canManageUsers ? '—' : members.loading ? '…' : members.error ? '—' : memberList.length} description={perms.canManageUsers ? 'Registered church members' : 'Access is restricted'} icon={<Users size={19} />} to={perms.canManageUsers ? '/admin/members' : null} />
      <SummaryCard label="New Christians" value={!perms.canManageMembership ? '—' : newChristians.loading ? '…' : newChristians.error ? '—' : believerList.length} description={perms.canManageMembership ? 'People in the follow-up journey' : 'Access is restricted'} icon={<UserRoundPlus size={19} />} to={perms.canManageMembership ? '/admin/new-christians' : null} />
    </div>

    <div className="admin-overview-main">
      <section className="admin-panel trend-panel">
        <div className="panel-heading"><div><span className="eyebrow blue">MEMBERSHIP</span><h2>Member registrations</h2></div><span className="muted">Last 6 months</span></div>
        {members.loading ? <div className="chart-skeleton skeleton" /> : members.error ? <p className="muted">Membership trend could not be loaded.</p> : <MembershipChart points={trend} />}
      </section>
      <section className="admin-panel departments-panel">
        <div className="panel-heading"><div><span className="eyebrow blue">TEAMS</span><h2>Departments</h2></div>{perms.has('staff.manage') ? <Button to="/admin/departments" size="sm" variant="ghost">View all</Button> : null}</div>
        {departments.loading ? <div className="stack"><div className="skeleton" style={{ height: '3.5rem' }} /><div className="skeleton" style={{ height: '3.5rem' }} /></div> : departments.error ? <p className="muted">Departments could not be loaded.</p> : !departmentList.length ? <EmptyState icon={<Building2 size={22} />} title="No departments yet" description="Registered departments will appear here." /> : <>
          <div className="department-summary-list">{visibleDepartments.map((department) => <Link className="department-summary-row" key={department.id} to="/admin/departments"><span className="department-avatar">{department.name?.slice(0, 1).toUpperCase()}</span><span><strong>{department.name}</strong><small>{department.leaderName || department.leader || 'Leader not assigned'}</small></span><ArrowRight size={15} /></Link>)}</div>
          {departmentList.length > PAGE_SIZE ? <div className="panel-pager"><button type="button" aria-label="Previous departments" disabled={departmentPage === 0} onClick={() => setDepartmentPage((page) => page - 1)}><ChevronLeft size={16} /></button><span>{departmentPage + 1} / {totalDepartmentPages}</span><button type="button" aria-label="Next departments" disabled={departmentPage >= totalDepartmentPages - 1} onClick={() => setDepartmentPage((page) => page + 1)}><ChevronRight size={16} /></button></div> : null}
        </>}
      </section>
    </div>

    <section className="admin-events-section"><div className="panel-heading"><div><span className="eyebrow blue">CALENDAR</span><h2>Upcoming events</h2></div>{perms.has('events.manage') ? <Button to="/admin/events" size="sm" variant="ghost">Manage events</Button> : null}</div>
      {events.loading ? <div className="event-card-grid">{[1, 2, 3].map((item) => <div key={item} className="card skeleton" style={{ height: '13rem' }} />)}</div> : events.error ? <p className="muted">Upcoming events could not be loaded.</p> : events.data?.length ? <div className="event-card-grid">{events.data.map((event) => <EventCard key={event.id ?? event.title} event={event} />)}</div> : <EmptyState icon={<CalendarDays size={24} />} title="No upcoming events" description="Scheduled events will appear here as soon as they are published." />}
    </section>
  </div>;
}

function SummaryCard({ label, value, description, icon, to }) {
  const content = <><span className="summary-icon">{icon}</span><strong>{value}</strong><span>{label}</span><small>{description}</small>{to ? <ArrowRight className="summary-arrow" size={16} /> : null}</>;
  return to ? <Link className="admin-summary-card" to={to}>{content}</Link> : <div className="admin-summary-card">{content}</div>;
}

function membershipTrend(members) {
  const today = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const count = members.filter((member) => {
      const created = member.createdAt ? new Date(member.createdAt) : null;
      return created && !Number.isNaN(created.valueOf()) && `${created.getFullYear()}-${created.getMonth()}` === key;
    }).length;
    return { label: date.toLocaleString(undefined, { month: 'short' }), value: count };
  });
}

function MembershipChart({ points }) {
  const maximum = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points.map((point, index) => `${8 + (index * 84) / Math.max(1, points.length - 1)},${72 - (point.value / maximum) * 54}`).join(' ');
  return <div className="membership-chart" aria-label="Monthly member registrations line chart"><svg viewBox="0 0 100 84" role="img"><line x1="8" y1="72" x2="92" y2="72" /><line x1="8" y1="45" x2="92" y2="45" /><line x1="8" y1="18" x2="92" y2="18" /><polyline points={coordinates} />{points.map((point, index) => { const x = 8 + (index * 84) / Math.max(1, points.length - 1); const y = 72 - (point.value / maximum) * 54; return <circle key={point.label} cx={x} cy={y} r="2.5"><title>{`${point.label}: ${point.value} registrations`}</title></circle>; })}</svg><div className="chart-labels">{points.map((point) => <span key={point.label}>{point.label}<b>{point.value}</b></span>)}</div></div>;
}
