import { Fragment, useState } from 'react';
import { MessageCircle, RefreshCw, Search, Send, ShieldAlert } from 'lucide-react';
import { adminService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const INBOX_STATUSES = ['NEW', 'IN_REVIEW', 'IN_PROGRESS', 'ASSIGNED', 'AWAITING_RESPONSE', 'REPLIED', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function formatStatus(value) {
  return String(value || 'NEW').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function TelegramInboxPage() {
  const { success } = useToast();
  const { user } = useAuth();
  const [filters, setFilters] = useState({ category: '', status: '', priority: '', search: '', from: '', to: '', assignedTo: '', channel: '' });
  const [drafts, setDrafts] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const inbox = useAsync(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
    const response = await adminService.telegramInbox({ limit: 100, ...params });
    return response.data;
  }, [filters.category, filters.status, filters.priority, filters.search, filters.from, filters.to, filters.assignedTo, filters.channel, loadVersion]);
  const messages = inbox.data?.data ?? [];
  const categories = inbox.data?.categories ?? [];
  const assignees = inbox.data?.assignees ?? [];
  const counts = inbox.data?.counts ?? {};

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function setDraft(id, value, collection = 'reply') {
    (collection === 'note' ? setNoteDrafts : setDrafts)((current) => ({ ...current, [id]: value }));
    setErrors((current) => ({ ...current, [id]: '' }));
  }

  async function mutateMessage(message, payload, label = 'Message updated') {
    setBusy((current) => ({ ...current, [message.id]: true }));
    setErrors((current) => ({ ...current, [message.id]: '' }));
    try {
      await adminService.updateTelegramMessage(message.id, payload);
      success(label);
      setLoadVersion((version) => version + 1);
    } catch (error) {
      setErrors((current) => ({ ...current, [message.id]: error.message || 'Could not update this message.' }));
    } finally {
      setBusy((current) => ({ ...current, [message.id]: false }));
    }
  }

  async function sendReply(message) {
    const text = drafts[message.id] ?? '';
    if (!text.trim()) {
      setErrors((current) => ({ ...current, [message.id]: 'Write a reply before sending.' }));
      return;
    }
    setBusy((current) => ({ ...current, [`${message.id}-reply`]: true }));
    try {
      await adminService.replyToTelegramMessage(message.id, { replyText: text, idempotencyKey: crypto.randomUUID() });
      setDrafts((current) => ({ ...current, [message.id]: '' }));
      success('Telegram reply sent');
      setLoadVersion((version) => version + 1);
    } catch (error) {
      setErrors((current) => ({ ...current, [message.id]: error.message || 'Reply was not sent. Your draft is preserved; review it and retry.' }));
    } finally {
      setBusy((current) => ({ ...current, [`${message.id}-reply`]: false }));
    }
  }

  async function addNote(message) {
    const note = noteDrafts[message.id] ?? '';
    if (!note.trim()) {
      setErrors((current) => ({ ...current, [message.id]: 'Write a private note before saving.' }));
      return;
    }
    setBusy((current) => ({ ...current, [`${message.id}-note`]: true }));
    try {
      await adminService.addTelegramMessageNote(message.id, { note });
      setNoteDrafts((current) => ({ ...current, [message.id]: '' }));
      success('Private note saved');
      setLoadVersion((version) => version + 1);
    } catch (error) {
      setErrors((current) => ({ ...current, [message.id]: error.message || 'The internal note could not be saved.' }));
    } finally {
      setBusy((current) => ({ ...current, [`${message.id}-note`]: false }));
    }
  }

  return (
    <div className="stack-lg telegram-inbox-workspace telegram-management-workspace">
      <div className="page-head">
        <div>
          <span className="eyebrow blue"><MessageCircle size={15} /> Telegram</span>
          <h1>Church contact inbox</h1>
          <p>Review categorized contact messages, assign follow-up, and reply through the sender’s Telegram chat.</p>
        </div>
        <Button type="button" variant="secondary" iconLeft={<RefreshCw size={15} />} onClick={() => setLoadVersion((version) => version + 1)}>Refresh</Button>
      </div>

      {inbox.loading ? <div className="event-grid">{Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)}</div>
        : inbox.error ? <ErrorMessage error={inbox.error} onRetry={inbox.reload} title="Inbox could not be loaded" />
          : (
            <>
              <section className="telegram-inbox-counts" aria-label="Message counts">
                {[
                  ['New', counts.NEW ?? 0, 'NEW'],
                  ['In review', (counts.IN_REVIEW ?? 0) + (counts.IN_PROGRESS ?? 0), 'IN_REVIEW'],
                  ['Assigned', counts.ASSIGNED ?? 0, 'ASSIGNED'],
                  ['Awaiting response', counts.AWAITING_RESPONSE ?? 0, 'AWAITING_RESPONSE'],
                  ['Resolved', counts.RESOLVED ?? 0, 'RESOLVED'],
                ].map(([label, count, status]) => (
                  <button className={`telegram-count-card ${filters.status === status ? 'is-active' : ''}`} type="button" key={status} onClick={() => setFilter('status', filters.status === status ? '' : status)}>
                    <span>{label}</span><strong>{count}</strong>
                  </button>
                ))}
              </section>
              <nav className="telegram-category-tabs" aria-label="Filter messages by category">
                <button type="button" className={!filters.category ? 'is-active' : ''} onClick={() => setFilter('category', '')}>All messages</button>
                {categories.map((category) => <button type="button" className={filters.category === category.code ? 'is-active' : ''} key={category.code} onClick={() => setFilter('category', filters.category === category.code ? '' : category.code)}>{category.label}</button>)}
              </nav>
              <section className="card telegram-inbox-filters" aria-label="Message filters">
                <label className="field telegram-search-filter"><span>Search messages</span><div className="telegram-search-input"><Search size={16} /><input className="input" value={filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Search reference, sender, or message" /></div></label>
                <label className="field"><span>Status</span><select className="input" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="">All statuses</option>{INBOX_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
                <label className="field"><span>Priority</span><select className="input" value={filters.priority} onChange={(event) => setFilter('priority', event.target.value)}><option value="">All priorities</option>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{formatStatus(priority)}</option>)}</select></label>
                <label className="field"><span>From</span><input className="input" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} /></label>
                <label className="field"><span>To</span><input className="input" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} /></label>
                <label className="field"><span>Assigned staff</span><select className="input" value={filters.assignedTo} onChange={(event) => setFilter('assignedTo', event.target.value)}><option value="">Anyone</option>{assignees.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label>
                <label className="field"><span>Channel</span><select className="input" value={filters.channel} onChange={(event) => setFilter('channel', event.target.value)}><option value="">All channels</option><option value="TELEGRAM">Telegram</option><option value="EMAIL">Email</option><option value="WEBSITE">Website</option></select></label>
              </section>
              {!messages.length ? <EmptyState icon={<MessageCircle size={28} />} title="No messages match these filters" description="New Telegram contact submissions will appear here after a member completes the category and confirmation flow." />
                : (
                  <div className="telegram-inbox-table-wrap">
                    <table className="telegram-inbox-table">
                      <thead><tr><th>Reference</th><th>Category</th><th>Sender</th><th>Submitted</th><th>Priority</th><th>Assigned staff</th><th>Status</th><th>Reply</th><th>Details</th></tr></thead>
                      <tbody>
                        {messages.map((message) => (
                          <Fragment key={message.id}>
                            <tr key={message.id} className={message.status === 'NEW' ? 'is-unread' : ''}>
                              <td><strong>{message.referenceCode || `TG-${message.id}`}</strong></td>
                              <td>{message.category}{message.isSensitive ? <span className="telegram-sensitive-label"><ShieldAlert size={13} /> Restricted</span> : null}</td>
                              <td>{message.isAnonymous ? 'Anonymous' : message.telegramDisplayName || message.telegramUsername || 'Telegram visitor'}{message.linkedUserName && !message.isAnonymous ? <small className="muted">Member: {message.linkedUserName}</small> : null}</td>
                              <td>{formatDate(message.receivedAt)}</td>
                              <td><select className="input telegram-table-select" aria-label={`Priority for ${message.referenceCode || message.id}`} value={message.priority} disabled={Boolean(busy[message.id])} onChange={(event) => void mutateMessage(message, { priority: event.target.value })}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{formatStatus(priority)}</option>)}</select></td>
                              <td>{message.assignedToName || 'Unassigned'}</td>
                              <td><select className="input telegram-table-select" aria-label={`Status for ${message.referenceCode || message.id}`} value={message.status} disabled={Boolean(busy[message.id])} onChange={(event) => void mutateMessage(message, { status: event.target.value })}>{INBOX_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></td>
                              <td>{message.replies?.length ? <><span>{message.replies.length} reply/replies</span><small>{formatStatus(message.replies.at(-1)?.status)}</small></> : 'No reply'}</td>
                              <td><Button type="button" size="sm" variant="secondary" aria-expanded={expandedId === message.id} onClick={() => setExpandedId(expandedId === message.id ? null : message.id)}>{expandedId === message.id ? 'Close' : 'Open'}</Button></td>
                            </tr>
                            {expandedId === message.id ? <tr key={`${message.id}-details`} className="telegram-detail-row"><td colSpan="9">
                              <div className="telegram-message-detail">
                                <div className="telegram-detail-header"><div><h2>{message.referenceCode || `Telegram message ${message.id}`}</h2><p className="muted">{formatDate(message.receivedAt)} · {message.sourceChannel || 'TELEGRAM'}</p></div>
                                  <label className="field"><span>Category</span><select className="input" value={message.categoryCode} onChange={(event) => void mutateMessage(message, { categoryCode: event.target.value })}>{categories.map((category) => <option key={category.code} value={category.code}>{category.label}</option>)}</select></label>
                                  <div className="telegram-assignment"><label className="field"><span>Assigned staff</span><select className="input" value={message.assignedTo ?? ''} onChange={(event) => void mutateMessage(message, { assignedTo: event.target.value || null }, event.target.value ? 'Message assigned' : 'Assignment removed')}><option value="">Unassigned</option>{assignees.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select></label><Button type="button" size="sm" variant="secondary" disabled={!user?.id} onClick={() => void mutateMessage(message, { assignedTo: user.id }, 'Assigned to you')}>Assign to me</Button></div>
                                </div>
                                <div className="telegram-inbound-message">{message.content || '[Message has no readable text]'}</div>
                                <section className="telegram-detail-section"><h3>Conversation replies</h3>{message.replies?.length ? message.replies.map((reply) => <article className={`telegram-reply telegram-reply-${String(reply.status).toLowerCase()}`} key={reply.id}><div className="row-between"><strong>{reply.sentBy || 'Church team'}</strong><span className="badge">{formatStatus(reply.status)}</span></div><p>{reply.replyText}</p>{reply.error ? <small className="field-error">Delivery failed: {reply.error}</small> : null}<small className="muted">{formatDate(reply.deliveredAt || reply.createdAt)}</small></article>) : <p className="muted">No replies have been sent.</p>}</section>
                                <section className="telegram-detail-section"><h3>Private staff notes <span className="badge">Internal only</span></h3>{message.notes?.map((note) => <article className="telegram-internal-note" key={note.id}><p>{note.note}</p><small className="muted">{note.createdBy || 'Staff'} · {formatDate(note.createdAt)}</small></article>)}<form className="telegram-reply-composer" onSubmit={(event) => { event.preventDefault(); void addNote(message); }}><label className="field"><span>Add internal note (not sent to the member)</span><textarea className="textarea" rows={3} maxLength={4000} value={noteDrafts[message.id] ?? ''} onChange={(event) => setDraft(message.id, event.target.value, 'note')} /></label><Button type="submit" variant="secondary" loading={Boolean(busy[`${message.id}-note`])}>Save private note</Button></form></section>
                                <section className="telegram-detail-section"><h3>Status history</h3>{message.statusHistory?.length ? message.statusHistory.map((entry, index) => <p className="muted" key={`${entry.createdAt}-${index}`}>{formatStatus(entry.oldStatus)} → {formatStatus(entry.newStatus)} · {entry.changedBy || 'Staff'} · {formatDate(entry.createdAt)}</p>) : <p className="muted">No status changes recorded.</p>}</section>
                                {message.status === 'CLOSED' || message.status === 'RESOLVED' ? <Alert variant="info">This request is resolved or closed. Reopen it before replying.</Alert> : <form className="telegram-reply-composer" onSubmit={(event) => { event.preventDefault(); void sendReply(message); }}><label className="field"><span>Reply to the member via Telegram</span><textarea className="textarea" rows={4} maxLength={4000} value={drafts[message.id] ?? ''} onChange={(event) => setDraft(message.id, event.target.value)} placeholder="Write a reply…" /></label><div className="row-between"><small className="muted">{(drafts[message.id] ?? '').length}/4000</small><Button type="submit" loading={Boolean(busy[`${message.id}-reply`])} iconRight={<Send size={14} />}>Send Telegram reply</Button></div></form>}
                                {errors[message.id] ? <Alert variant="danger">{errors[message.id]}</Alert> : null}
                              </div>
                            </td></tr> : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </>
          )}
    </div>
  );
}
