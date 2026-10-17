import PageHero from '../../components/layout/PageHero.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import { CardSkeleton } from '../../components/ui/Skeleton.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import { formatEventDate } from '../../ethiopianDate.js';
import Button from '../../components/ui/Button.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';

export default function SermonsPage() {
  const { calendar } = useSettings();

  const sermons = useAsync(async () => {
    const res = await publicService.sermons({ limit: 24 });
    return unwrap(res) ?? [];
  }, []);

  return (
    <div className="app-main">
      <PageHero eyebrow="Sermons" title="Listen and grow" subtitle="Messages and teaching to encourage your walk through the week." imageUrl="https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1920&q=85" />
      <div className="container-wide" style={{ padding: '0 0 3.5rem' }}>
        <div className="section-head" style={{ marginBottom: '2rem' }}>
          <span className="eyebrow blue"><span className="dot" /> Sermons</span>
          <h1 className="serif" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)' }}>Latest messages &amp; teaching</h1>
          <p className="lead">Teaching from the whole counsel of Scripture, recorded across services and shared online for you to listen at any time.</p>
        </div>

        {sermons.loading ? (
          <div className="grid-auto">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        ) : sermons.error ? (
          <ErrorMessage error={sermons.error} />
        ) : sermons.data && sermons.data.length > 0 ? (
          <div className="grid-auto">
            {sermons.data.map((s) => (
              <div key={s.id ?? s.title} className="card card-hover">
                <div className="card-body">
                  <div className="row" style={{ alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span className="badge">Sermon</span>
                    <span className="badge badge-neutral">{s.series ? s.series : ''}</span>
                  </div>
                  {s.title ? <h3>{s.title}</h3> : null}
                  <div className="row" style={{ marginBottom: '0.6rem' }}>
                    <span className="muted" style={{ width: '6.5rem', fontSize: '0.84rem' }}>{s.preacher ?? ''}</span>
                    {s.date ? <span className="muted" style={{ fontSize: '0.84rem' }}>{formatEventDate(s.date, calendar)}</span> : null}
                    {s.readTime ? <span className="muted" style={{ fontSize: '0.84rem' }}>· {s.readTime}</span> : null}
                  </div>
                  {s.audioUrl || s.videoUrl ? (
                    <div className="row" style={{ marginTop: '0.5rem' }}>
                      <Button variant="light" iconRight={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ borderRadius: '50%' }}><polygon points="5,3 19,12 5,21" /></svg>}>Listen</Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5,3 19,12 5,21" /></svg>} title="No sermons published yet" description="New sermons are uploaded after each service. Please check back soon." />
        )}
      </div>
    </div>
  );
}
