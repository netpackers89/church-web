import { CheckCircle2, Clock3, HandHeart, Printer, Receipt, XCircle, RotateCcw } from 'lucide-react';
import { publicService, unwrap, userService } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import DataState from '../../components/ui/DataState.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatEventDate } from '../../utils/formatDate.js';

function formatMoney(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'ETB 0.00';
  return `ETB ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MyGivingPage() {
  const campaigns = useAsync(async () => unwrap(await publicService.campaigns()) ?? [], []);
  const records = useAsync(async () => unwrap(await userService.myGiving()) ?? [], []);

  const statusMeta = {
    PENDING: { label: 'Pending verification', color: '#b7781f', icon: Clock3 },
    APPROVED: { label: 'Approved', color: '#1c7d51', icon: CheckCircle2 },
    REJECTED: { label: 'Rejected', color: '#af3a32', icon: XCircle },
  };

  return (
    <div className="stack-lg">
      <div className="page-head">
        <div>
          <h1>My giving</h1>
          <p>Your giving history and the campaigns you can support.</p>
        </div>
        <div className="page-actions">
          <Button to="/give" variant="secondary" iconRight={<HandHeart size={15} />}>Give now</Button>
        </div>
      </div>

      <div className="card card-pad-lg">
        <h2 className="serif" style={{ fontSize: '1.3rem', marginBottom: '0.8rem' }}>Giving history</h2>
        <DataState
          query={records}
          feature="My giving history"
          endpoint="/users/me/giving"
          skeletonCount={3}
          emptyState={<EmptyState icon={<Receipt size={30} />} title="No giving records yet" description="Your bank-transfer submissions will appear here after you submit them for review." />}
        >
          {(list) => (
            <div className="stack" style={{ gap: '0.9rem' }}>
              {list.map((item) => {
                const meta = statusMeta[item.status] ?? { label: item.status ?? 'Submitted', color: '#4a4a53', icon: Clock3 };
                const Icon = meta.icon;
                return (
                  <div key={item.id} className="card" style={{ padding: '1rem', border: '1px solid var(--line)' }}>
                    <div className="row-between" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.categoryName || 'Offering'}</div>
                        <div className="muted">{item.campaignTitle || 'General giving'}</div>
                      </div>
                      <span className="badge" style={{ background: `${meta.color}1a`, color: meta.color, borderColor: `${meta.color}33` }}>
                        <Icon size={14} style={{ display: 'inline' }} /> {meta.label}
                      </span>
                    </div>

                    <div className="row-between" style={{ marginTop: '0.9rem', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</div>
                        <strong>{formatMoney(item.amount)}</strong>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transfer date</div>
                        <span>{item.receivedAt ? formatEventDate(item.receivedAt, 'gregorian') : '—'}</span>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference</div>
                        <span>{item.paymentReference || '—'}</span>
                      </div>
                    </div>

                    {item.status === 'APPROVED' ? (
                      <div style={{ marginTop: '0.9rem' }}>
                        <Button to={`/me/giving/${item.id}/receipt`} variant="secondary" size="sm" iconRight={<Printer size={14} />}>View confirmed receipt</Button>
                      </div>
                    ) : null}
                    {item.status === 'REJECTED' ? (
                      <div className="giving-resubmission-action">
                        {item.rejectionReason ? <p><strong>Finance review:</strong> {item.rejectionReason}</p> : null}
                        <Button to={`/give?resubmit=${item.id}`} size="sm" variant="secondary" iconRight={<RotateCcw size={14} />}>Correct and resubmit</Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </DataState>
      </div>

      <div>
        <h2 className="serif" style={{ fontSize: '1.3rem', marginBottom: '0.8rem' }}>Campaigns you can support</h2>
        <DataState
          query={campaigns}
          feature="Giving campaigns"
          endpoint="/public/campaigns"
          skeletonCount={2}
          emptyState={<EmptyState icon={<HandHeart size={30} />} title="No active campaigns" description="When a new campaign launches, it will appear here." />}
        >
          {(list) => (
            <div className="grid-auto">
              {list.map((c) => (
                <div key={c.id ?? c.title} className="card card-hover">
                  <div className="card-body">
                    <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span className="badge">{c.category ?? 'Campaign'}</span>
                      {c.endsAt ? <span className="badge badge-neutral">Ends {formatEventDate(c.endsAt, 'gregorian')}</span> : null}
                    </div>
                    {c.title ? <h3>{c.title}</h3> : null}
                    {c.description ? <p className="muted" style={{ fontSize: '0.9rem' }}>{c.description}</p> : null}
                    {c.goalAmount ? (
                      <div style={{ marginTop: '0.8rem' }}>
                        <div className="progress"><div className="progress-bar" style={{ width: `${Math.min(100, Math.round(((c.raisedAmount ?? 0) / c.goalAmount) * 100))}%` }} /></div>
                        <div className="progress-meta"><span className="muted">{c.raisedAmount ?? 0} raised</span><span className="muted">Goal {c.goalAmount}</span></div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DataState>
      </div>
    </div>
  );
}
