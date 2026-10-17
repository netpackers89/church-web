import { MapPin } from 'lucide-react';
import PageHero from '../../components/layout/PageHero.jsx';
import useAsync from '../../hooks/useAsync.js';
import { publicService, unwrap } from '../../services/api.js';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import Button from '../../components/ui/Button.jsx';

export default function AnnouncementsPage() {
  const announcements = useAsync(async () => {
    const res = await publicService.announcements();
    return unwrap(res) ?? [];
  }, []);

  return (
    <div className="app-main">
      <PageHero
        eyebrow="Announcements"
        title="Announcements"
        subtitle="Church-wide news, events, and updates for members and the public."
        imageUrl="https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1920&q=85"
      />
      <section className="container-wide" style={{ padding: '0 0 3.5rem' }}>
        <div className="section-head" style={{ marginBottom: '2rem' }}>
          <span className="eyebrow"><span className="dot" /> Church announcements</span>
          <h1 className="serif" style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)' }}>Current announcements</h1>
        </div>
        {announcements.loading ? (
          <div className="grid-auto">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card card-hover"><div className="card-body"><div className="skeleton" style={{ height: '1rem', width: '60%' }} /></div></div>)}</div>
        ) : null}
        {announcements.error ? <ErrorMessage error={announcements.error} /> : null}
        {!announcements.loading && !announcements.error && announcements.data && announcements.data.length === 0 ? (
          <EmptyState title="No announcements yet" description="New announcements will appear here once published." />
        ) : null}
        {!announcements.loading && !announcements.error && announcements.data && announcements.data.length > 0 ? (
          <div className="grid-auto" style={{ gap: '1rem' }}>
            {announcements.data.map((a) => (
              <article key={a.id ?? a.title} className="card card-hover announcement-card">
                {a.imageUrl ? <img src={a.imageUrl} alt={a.title ?? ''} style={{ width: '100%', height: '12rem', objectFit: 'cover', display: 'block' }} /> : null}
                <div className="card-body">
                  <div className="row" style={{ marginBottom: '0.5rem' }}>
                    <span className="badge badge-success">Published</span>
                  </div>
                  {a.title ? <h3>{a.title}</h3> : null}
                  {a.body ? <p className="muted" style={{ fontSize: '0.92rem', flex: 1 }}>{a.body}</p> : null}
                  {a.publishedAt ? <span className="muted" style={{ fontSize: '0.8rem' }}>Published {new Date(a.publishedAt).toLocaleDateString()}</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
