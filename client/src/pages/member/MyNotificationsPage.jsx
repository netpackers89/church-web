import { useState } from 'react';
import { Bell, Check, Mail } from 'lucide-react';
import { userService } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Alert from '../../components/ui/Alert.jsx';
import ReliableImage from '../../components/ui/ReliableImage.jsx';

function safeNotificationLink(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const link = value.trim();
  if (link.startsWith('/') && !link.startsWith('//') && !link.includes('\\')) return link;
  try {
    const url = new URL(link);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export default function MyNotificationsPage() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState('');
  const notifications = useAsync(async () => {
    const response = await userService.notifications();
    setUnreadCount(Number(response.data?.meta?.unreadCount ?? 0));
    return response?.data?.data ?? response?.data ?? [];
  }, []);

  function notifyShell() {
    window.dispatchEvent(new CustomEvent('church:notifications-updated'));
  }

  async function markRead(notificationId) {
    setBusyId(notificationId);
    setActionError('');
    try {
      await userService.markNotificationRead(notificationId);
      await notifications.reload();
      notifyShell();
    } catch (error) {
      setActionError(error.message || 'This notification could not be marked as read.');
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setActionError('');
    try {
      await userService.markAllNotificationsRead();
      await notifications.reload();
      notifyShell();
    } catch (error) {
      setActionError(error.message || 'Your notifications could not be marked as read.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Church announcements and messages sent to you.</p>
          <p className="muted" role="status">{unreadCount} unread</p>
        </div>
        <div className="page-actions">
          {unreadCount > 0 ? <Button variant="secondary" iconRight={<Check size={15} />} loading={markingAll} onClick={markAllRead}>Mark all as read</Button> : null}
          <Button to="/me/account" variant="secondary" iconRight={<Mail size={15} />}>Notification settings</Button>
        </div>
      </div>

      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

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
            {list.map((notification) => {
              const isRead = Boolean(notification.readAt) || notification.status === 'READ';
              const relatedLink = safeNotificationLink(notification.linkUrl);
              return (
                <li key={notification.id} className="card card-body" style={{ display: 'grid', gap: '0.8rem' }}>
                  <div className="row" style={{ alignItems: 'flex-start', gap: '0.9rem' }}>
                    <span className="stat-icon" style={{ display: 'grid', placeItems: 'center', width: '2.4rem', height: '2.4rem', borderRadius: 'var(--r-md)', background: 'var(--blue-soft)', color: 'var(--blue)', flex: 'none' }}>
                      <Bell size={17} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <strong>{notification.title ?? 'Notification'}</strong>
                        <Badge variant={isRead ? 'neutral' : 'warning'}>{isRead ? 'Read' : 'Unread'}</Badge>
                      </div>
                      {notification.createdAt ? <time className="muted" dateTime={notification.createdAt} style={{ display: 'block', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                        {new Date(notification.createdAt).toLocaleString()}
                      </time> : null}
                      <details style={{ marginTop: '0.65rem' }}>
                        <summary style={{ cursor: 'pointer', color: 'var(--blue)', fontWeight: 600 }}>View details</summary>
                        <div className="stack-sm" style={{ marginTop: '0.7rem' }}>
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{notification.body ?? notification.message ?? ''}</p>
                          {notification.imageUrl ? <ReliableImage
                            src={notification.imageUrl}
                            alt=""
                            fallback={<p className="muted">This notification image is unavailable.</p>}
                            style={{ width: '100%', maxWidth: '28rem', maxHeight: '14rem', objectFit: 'cover', borderRadius: '0.6rem' }}
                          /> : null}
                          {relatedLink ? <a href={relatedLink} target={relatedLink.startsWith('/') ? undefined : '_blank'} rel={relatedLink.startsWith('/') ? undefined : 'noreferrer'}>
                            Open related page
                          </a> : null}
                        </div>
                      </details>
                    </div>
                    {!isRead ? <Button size="sm" variant="ghost" loading={busyId === notification.id} disabled={busyId !== null || markingAll} onClick={() => markRead(notification.id)}>Mark read</Button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DataState>
    </div>
  );
}
