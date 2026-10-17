import { useState } from 'react';
import { Check, Clock3, Landmark, RefreshCw, X } from 'lucide-react';
import { givingService } from '../../services/index.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Alert from '../../components/ui/Alert.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

const FILTERS = ['', 'PENDING', 'APPROVED', 'REJECTED'];

function money(amount, currency = 'ETB') {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`;
}

export default function GivingManagementPage() {
  const { success } = useToast();
  const [status, setStatus] = useState('PENDING');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejection, setRejection] = useState({ reason: '', reviewerNotes: '' });
  const [error, setError] = useState('');
  const queue = useAsync(async () => {
    const response = await givingService.financeQueue({ limit: 100, ...(status ? { status } : {}) });
    return response.data?.data ?? [];
  }, [status, version]);

  async function approve(record) {
    setBusy((current) => ({ ...current, [record.id]: true }));
    setError('');
    try {
      const response = await givingService.approve(record.id, { reviewerNotes: rejection.reviewerNotes });
      const outcomes = response.data?.data?.notificationOutcomes ?? {};
      const failed = Object.values(outcomes).some((item) => item.status === 'FAILED');
      success(failed ? 'Contribution approved; a donor notification failed' : 'Contribution approved and receipt enabled');
      setVersion((current) => current + 1);
    } catch (failure) {
      setError(failure.message || 'Could not approve this transaction.');
    } finally {
      setBusy((current) => ({ ...current, [record.id]: false }));
    }
  }

  async function reject(event, record) {
    event.preventDefault();
    if (!rejection.reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    setBusy((current) => ({ ...current, [record.id]: true }));
    setError('');
    try {
      await givingService.reject(record.id, rejection);
      success('Contribution rejected; the reason was recorded');
      setRejectingId(null);
      setRejection({ reason: '', reviewerNotes: '' });
      setVersion((current) => current + 1);
    } catch (failure) {
      setError(failure.message || 'Could not reject this transaction.');
    } finally {
      setBusy((current) => ({ ...current, [record.id]: false }));
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>Contribution verification</h1>
          <p>Review submitted transaction details. Submissions remain pending until an authorized finance decision.</p>
        </div>
        <div className="page-actions">
          <select aria-label="Filter contributions by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {FILTERS.filter(Boolean).map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
          </select>
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => setVersion((current) => current + 1)}>Refresh</Button>
        </div>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {queue.loading ? <div className="event-grid">{Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)}</div>
        : queue.error ? <ErrorMessage error={queue.error} onRetry={queue.reload} title="Giving records could not be loaded" />
          : queue.data?.length ? (
            <div className="giving-review-list">
              {queue.data.map((record) => (
                <article className="card giving-review-record" key={record.id}>
                  <div className="row-between giving-review-top">
                    <div>
                      <span className={`badge ${record.status === 'PENDING' ? 'badge-warning' : record.status === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>
                        {record.status === 'PENDING' ? <Clock3 size={13} /> : null} {record.status.replaceAll('_', ' ')}
                      </span>
                      <h2>{record.contributorName || record.userName || 'Church member'}</h2>
                      {record.userEmail ? <span className="muted">{record.userEmail}</span> : null}
                    </div>
                    <strong className="giving-review-amount">{money(record.amount, record.currency)}</strong>
                  </div>

                  <dl className="giving-review-details">
                    <div><dt>Payment provider</dt><dd><Landmark size={14} /> {record.paymentProvider || 'Provider not recorded'}</dd></div>
                    <div><dt>Transaction reference</dt><dd>{record.paymentReference}</dd></div>
                    <div><dt>Giving category</dt><dd>{record.categoryName || 'General giving'}</dd></div>
                    <div><dt>Campaign</dt><dd>{record.campaignTitle || '—'}</dd></div>
                    <div><dt>Payment date</dt><dd>{record.receivedAt ? new Date(record.receivedAt).toLocaleDateString() : '—'}</dd></div>
                    <div><dt>Submitted</dt><dd>{record.createdAt ? new Date(record.createdAt).toLocaleString() : '—'}</dd></div>
                    <div><dt>Evidence</dt><dd>{record.receiptUrl ? <a href={record.receiptUrl} target="_blank" rel="noreferrer">View attachment</a> : 'No attachment'}</dd></div>
                    <div><dt>Reviewer notes</dt><dd>{record.reviewerNotes || record.rejectionReason || '—'}</dd></div>
                  </dl>
                  {record.note ? <div className="giving-donor-note"><strong>Contributor note</strong><p>{record.note}</p></div> : null}

                  {record.reviewHistory?.length ? (
                    <details className="giving-review-history">
                      <summary>Previous decisions ({record.reviewHistory.length})</summary>
                      <ul>{record.reviewHistory.map((entry, index) => <li key={`${record.id}-${index}`}><strong>{entry.decision}</strong> · {entry.reviewer || 'Finance'} · {new Date(entry.createdAt).toLocaleString()}{entry.note ? <p>{entry.note}</p> : null}</li>)}</ul>
                    </details>
                  ) : null}

                  {record.status === 'PENDING' ? (
                    rejectingId === record.id ? (
                      <form className="giving-reject-form" onSubmit={(event) => reject(event, record)}>
                        <Input label="Rejection reason (required)" type="textarea" rows={3} value={rejection.reason} onChange={(event) => setRejection((current) => ({ ...current, reason: event.target.value }))} required />
                        <Input label="Private reviewer notes (optional)" type="textarea" rows={2} value={rejection.reviewerNotes} onChange={(event) => setRejection((current) => ({ ...current, reviewerNotes: event.target.value }))} />
                        <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <Button type="button" variant="secondary" onClick={() => setRejectingId(null)}>Cancel</Button>
                          <Button type="submit" variant="danger" loading={Boolean(busy[record.id])} icon={<X size={14} />}>Reject submission</Button>
                        </div>
                      </form>
                    ) : (
                      <div className="row giving-review-actions">
                        <Button onClick={() => approve(record)} loading={Boolean(busy[record.id])} icon={<Check size={15} />}>Approve and issue receipt</Button>
                        <Button variant="secondary" onClick={() => { setRejectingId(record.id); setRejection({ reason: '', reviewerNotes: '' }); }}>Reject</Button>
                      </div>
                    )
                  ) : record.status === 'APPROVED' ? <strong className="muted">Receipt {record.receiptNumber || 'available after review'}</strong> : null}
                </article>
              ))}
            </div>
          ) : <EmptyState icon={<Landmark size={28} />} title={status === 'PENDING' ? 'No contributions awaiting review' : 'No contributions found'} description="Submitted contributions will appear here with their provider and transaction reference." />}
    </div>
  );
}
