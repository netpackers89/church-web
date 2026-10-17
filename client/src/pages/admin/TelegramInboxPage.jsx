import { useState } from 'react';
import { MessageCircle, RefreshCw, Send } from 'lucide-react';
import { adminService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const INBOX_STATUSES = ['NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED'];

function formatStatus(value) {
  return String(value || 'NEW').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function TelegramInboxPage() {
  const { success } = useToast();
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const [loadVersion, setLoadVersion] = useState(0);
  const inbox = useAsync(async () => {
    const response = await adminService.telegramInbox({ limit: 100, ...(status ? { status } : {}) });
    return response.data?.data ?? [];
  }, [status, loadVersion]);

  function setDraft(id, value) {
    setDrafts((current) => ({ ...current, [id]: value }));
    setErrors((current) => ({ ...current, [id]: '' }));
  }

  async function sendReply(message) {
    const text = drafts[message.id] ?? '';
    if (!text.trim()) {
      setErrors((current) => ({ ...current, [message.id]: 'Write a reply before sending.' }));
      return;
    }
    setBusy((current) => ({ ...current, [message.id]: true }));
    setErrors((current) => ({ ...current, [message.id]: '' }));
    try {
      await adminService.replyToTelegramMessage(message.id, {
        replyText: text,
        idempotencyKey: crypto.randomUUID(),
      });
      setDrafts((current) => ({ ...current, [message.id]: '' }));
      success('Reply sent');
      setLoadVersion((version) => version + 1);
    } catch (error) {
      setErrors((current) => ({ ...current, [message.id]: error.message || 'Reply was not sent. Your draft is preserved; review it and retry.' }));
      setLoadVersion((version) => version + 1);
    } finally {
      setBusy((current) => ({ ...current, [message.id]: false }));
    }
  }

  async function updateStatus(message, nextStatus) {
    setBusy((current) => ({ ...current, [`${message.id}-status`]: true }));
    try {
      await adminService.updateTelegramMessage(message.id, { status: nextStatus });
      success('Conversation status updated');
      setLoadVersion((version) => version + 1);
    } catch (error) {
      setErrors((current) => ({ ...current, [message.id]: error.message || 'Could not update conversation status.' }));
    } finally {
      setBusy((current) => ({ ...current, [`${message.id}-status`]: false }));
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <span className="eyebrow blue"><MessageCircle size={15} /> Telegram</span>
          <h1>Inbox</h1>
          <p>Read messages sent directly to the church bot and reply to the same Telegram chat.</p>
        </div>
        <div className="page-actions">
          <select aria-label="Filter inbox by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {INBOX_STATUSES.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}
          </select>
          <Button type="button" variant="secondary" icon={<RefreshCw size={15} />} onClick={() => setLoadVersion((version) => version + 1)}>Refresh</Button>
        </div>
      </div>

      {inbox.loading ? <div className="event-grid">{Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)}</div>
        : inbox.error ? <ErrorMessage error={inbox.error} onRetry={inbox.reload} title="Inbox could not be loaded" />
          : inbox.data?.length ? (
            <div className="telegram-inbox-list">
              {inbox.data.map((message) => (
                <article className="card telegram-inbox-message" key={message.id}>
                  <div className="row-between telegram-inbox-heading">
                    <div>
                      <h2>{message.telegramDisplayName || message.telegramUsername || 'Telegram visitor'}</h2>
                      <p className="muted">{new Date(message.receivedAt).toLocaleString()}{message.linkedUserName ? ` · Linked member: ${message.linkedUserName}` : ''}</p>
                    </div>
                    <select aria-label={`Conversation status for ${message.telegramDisplayName || 'sender'}`} value={message.status} disabled={Boolean(busy[`${message.id}-status`])} onChange={(event) => updateStatus(message, event.target.value)}>
                      {INBOX_STATUSES.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}
                    </select>
                  </div>

                  <div className="telegram-inbound-message">{message.content || '[Message has no readable text]'}</div>

                  <div className="telegram-reply-thread" aria-label="Reply history">
                    {(message.replies ?? []).map((reply) => (
                      <div className={`telegram-reply telegram-reply-${String(reply.status).toLowerCase()}`} key={reply.id}>
                        <div className="row-between"><strong>{reply.sentBy || 'Church team'}</strong><span className="badge">{formatStatus(reply.status)}</span></div>
                        <p>{reply.replyText}</p>
                        {reply.error ? <small className="field-error">Delivery failed: {reply.error}</small> : null}
                        <small className="muted">{new Date(reply.deliveredAt || reply.createdAt).toLocaleString()}</small>
                      </div>
                    ))}
                  </div>

                  {message.status === 'CLOSED' ? <Alert variant="info">Reopen this conversation before replying.</Alert> : (
                    <form className="telegram-reply-composer" onSubmit={(event) => { event.preventDefault(); void sendReply(message); }}>
                      <label className="field">
                        <span>Reply in Telegram</span>
                        <textarea
                          className="textarea"
                          rows={4}
                          maxLength={4000}
                          value={drafts[message.id] ?? ''}
                          onChange={(event) => setDraft(message.id, event.target.value)}
                          placeholder="Write your reply…"
                          aria-label={`Reply to ${message.telegramDisplayName || 'Telegram sender'}`}
                        />
                      </label>
                      <div className="row-between telegram-composer-footer">
                        <small className="muted">{(drafts[message.id] ?? '').length}/4000</small>
                        <Button type="submit" loading={Boolean(busy[message.id])} iconRight={<Send size={14} />}>Send reply</Button>
                      </div>
                      {errors[message.id] ? <Alert variant="danger">{errors[message.id]}</Alert> : null}
                    </form>
                  )}
                </article>
              ))}
            </div>
          ) : <EmptyState icon={<MessageCircle size={28} />} title="Inbox is clear" description="Messages sent directly to the church Telegram bot will appear here." />}
    </div>
  );
}
