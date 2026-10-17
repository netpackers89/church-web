import PageHero from '../../components/layout/PageHero.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { formatEventDate } from '../../ethiopianDate.js';
import Button from '../../components/ui/Button.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function CampaignsPage() {
  const { calendar } = useSettings();

  const campaigns = useAsync(async () => {
    const res = await publicService.campaigns();
    return unwrap(res) ?? [];
  }, []);

  return (
    <div className="app-main">
      <PageHero eyebrow="Campaigns" title="Give toward what matters" subtitle="Support approved church projects and community efforts." imageUrl="https://images.unsplash.com/photo-1593113646773-028c64a8f1b8?auto=format&fit=crop&w=1920&q=85" />
      <div className="container-wide" style={{ padding: '0 0 3.5rem' }}>
        <div className="section-head" style={{ marginBottom: '2rem' }}>
          <span className="eyebrow blue"><span className="dot" /> Giving &amp; giving campaigns</span>
          <h1 className="serif" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)' }}>Current campaigns and giving</h1>
          <p className="lead">Current and upcoming giving campaigns that help us serve the community and support our ministries.</p>
        </div>

        {campaigns.loading ? (
          <div className="grid-auto">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : campaigns.error ? (
          <ErrorMessage error={campaigns.error} />
        ) : campaigns.data && campaigns.data.length > 0 ? (
          <div className="grid-auto">
            {campaigns.data.map((c) => (
              <div key={c.id ?? c.title} className="card card-hover">
                {c.bannerUrl ? <img src={c.bannerUrl} alt="" style={{ width: '100%', height: '11rem', objectFit: 'cover', display: 'block' }} /> : null}
                <div className="card-body">
                  <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge">{c.displayStatus || 'Campaign'}</span>
                    <span className="badge badge-gold">{c.category ?? 'Giving'}</span>
                  </div>
                  {c.title ? <h3>{c.title}</h3> : null}
                  {c.description ? <p className="muted" style={{ fontSize: '0.92rem' }}>{c.description}</p> : null}
                  {c.goalAmount !== null && c.goalAmount !== undefined ? <><div className="row" style={{ marginTop: '0.8rem' }}><span className="muted" style={{ fontSize: '0.84rem' }}>Raised</span><strong>{c.raisedAmount ?? 0} {c.currency} of {c.goalAmount} {c.currency}</strong></div><progress value={Number(c.raisedAmount ?? 0)} max={Math.max(Number(c.goalAmount), 1)} style={{ width: '100%', marginTop: '0.45rem' }} /></> : null}
                  {c.endsAt ? <div className="row" style={{ marginTop: '0.3rem' }}><span className="muted" style={{ fontSize: '0.84rem' }}>Ends</span><strong>{formatEventDate(c.endsAt, calendar)}</strong></div> : null}
                  <Button to={c.ctaUrl || '/give'} variant="light">Give toward this campaign</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>} title="No campaigns listed yet" description="Giving campaigns are shared at the start of each season. Please contact the office for current opportunities." />
        )}
      </div>
    </div>
  );
}
