import { Bell, Mail, Info } from 'lucide-react';
import { userService } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';

export default function MyNotificationsPage() {
  const notifications = useAsync(async () => {
    const res = await userService.notifications();
    return res?.data?.data ?? res?.data ?? [];
  }, []);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Church announcements and messages sent to you.</p>
        </div>
        <div className="page-actions">
          <Button to="/me/account" variant="secondary" iconRight={<Mail size={15} />}>Notification settings</Button>
        </div>
      </div>

      <DataState
        query={notifications}
        feature="Notifications"
        endpoint="/users/me/notifications"
        emptyState={
          <EmptyState
            icon={<Bell size={30} />}
            title="No notifications"
            description="Announcements and reminders sent by the church will appear here."
          />
        }
      >
        {(list) => (
          <ul className="stack">
            {list.map((n) => (
              <li key={n.id} className="card card-body row" style={{ alignItems: 'flex-start', gap: '0.9rem' }}>
                <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)', flex: 'none' }}>
                  <Info size={17} />
                </span>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block' }}>{n.title ?? 'Notification'}</strong>
                  {n.imageUrl ? <img src={n.imageUrl} alt="" style={{ width: '100%', maxWidth: '28rem', maxHeight: '14rem', objectFit: 'cover', borderRadius: '0.6rem', marginTop: '0.6rem' }} /> : null}
                  <span className="muted" style={{ fontSize: '0.9rem' }}>{n.body ?? n.message ?? ''}</span>
                  {n.createdAt ? <span className="muted" style={{ display: 'block', fontSize: '0.78rem', marginTop: '0.2rem' }}>{new Date(n.createdAt).toLocaleString()}</span> : null}
                </span>
                {!n.readAt ? <Button size="sm" variant="ghost" onClick={async () => { await userService.markNotificationRead(n.id); notifications.reload(); }}>Mark read</Button> : null}
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </div>
  );
}
