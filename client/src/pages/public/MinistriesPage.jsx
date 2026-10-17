import PageHero from '../../components/layout/PageHero.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import Button from '../../components/ui/Button.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { formatEventDate } from '../../ethiopianDate.js';
import { useSettings } from '../../context/SettingsContext.jsx';


export default function MinistriesPage() {
  const { calendar: _calendar } = useSettings();

  const ministries = useAsync(async () => {
    const res = await publicService.ministries();
    return unwrap(res) ?? [];
  }, []);

  return (
    <div className="app-main">
      <PageHero eyebrow="Ministries" title="Serve and belong" subtitle="Explore ways to share your gifts and find community." imageUrl="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=85" />
      <div className="container-wide" style={{ padding: '0 0 3.5rem' }}>
        <div className="section-head" style={{ marginBottom: '2rem' }}>
          <span className="eyebrow blue">
            <span className="dot" /> Ministries
          </span>
          <h1 className="serif" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)' }}>
            Serve &amp; belong through our ministries
          </h1>
          <p className="lead">
            Every member has gifts for ministry. Explore our teams and see how you can make a difference in the life of the church.
          </p>
        </div>

        {ministries.loading ? (
          <div className="grid-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card card-hover" style={{ minHeight: '8rem' }}>
                <div className="card-body">
                  <div className="skeleton" style={{ height: '0.9rem', width: '50%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : ministries.error ? (
          <ErrorMessage error={ministries.error} />
        ) : ministries.data && ministries.data.length > 0 ? (
          <div className="grid-auto">
            {ministries.data.map((m) => (
              <div key={m.id ?? m.title ?? m.name} className="card card-hover">
                <div className="card-body">
                  <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge">Ministry</span>
                    {m.type && <span className="badge badge-neutral">{m.type.toLowerCase()}</span>}
                  </div>
                  <h3>{m.title || m.name}</h3>
                  {m.description && (
                    <p className="muted" style={{ fontSize: '0.92rem' }}>
                      {m.description}
                    </p>
                  )}
                  {m.contactEmail && (
                    <div className="row" style={{ marginTop: '0.6rem', gap: '0.6rem', alignItems: 'center' }}>
                      <Button variant="light" size="sm" href={`mailto:${m.contactEmail}`}>
                        Contact ministry
                      </Button>
                      <span className="muted" style={{ fontSize: '0.86rem', wordBreak: 'break-all' }}>
                        {m.contactEmail}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            }
            title="No ministries listed yet"
            description="New ministries are announced at the start of each term. Ask your small group leader for ways to serve."
          />
        )}
      </div>
    </div>
  );
}
