import { Copy, Share2 } from 'lucide-react';
import PageHero from '../../components/layout/PageHero.jsx';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';
import EmptyState from '../../components/ui/EmptyState.jsx';
import ErrorMessage from '../../components/feedback/ErrorMessage.jsx';
import Button from '../../components/ui/Button.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';

export default function BibleVersesPage() {
  const { success } = useToast();
  const verses = useAsync(async () => unwrap(await publicService.verses({ limit: 30 })) ?? [], []);
  async function copy(verse) {
    await navigator.clipboard?.writeText(`“${verse.text}” — ${verse.reference}`);
    success('Verse copied');
  }
  async function share(verse) {
    const text = `“${verse.text}” — ${verse.reference}`;
    if (navigator.share) await navigator.share({ title: verse.reference, text }); else await copy(verse);
  }
  return <div className="app-main"><PageHero eyebrow="Scripture" title="Words to carry with you" subtitle="Read and reflect on selected passages from Scripture." imageUrl="https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1920&q=85" /><div className="container-wide" style={{ padding: '0 0 3.5rem' }}>
    <div className="section-head"><span className="eyebrow blue"><span className="dot" /> Scripture</span><h1 className="serif">Bible verses</h1><p className="lead">Recently published Scripture for reflection, encouragement, and sharing.</p></div>
    {verses.loading ? <div className="grid-auto">{[1,2,3].map((id) => <div key={id} className="card skeleton" style={{ height: '13rem' }} />)}</div> : null}
    {verses.error ? <ErrorMessage error={verses.error} onRetry={verses.reload} /> : null}
    {!verses.loading && !verses.error && !verses.data.length ? <EmptyState title="No verses published yet" description="Please check back soon for a published verse." /> : null}
    <div className="grid-auto">{verses.data?.map((verse) => <article className="card card-body" key={verse.id} style={verse.backgroundImageUrl ? { backgroundImage: `linear-gradient(rgba(20,36,32,.84),rgba(20,36,32,.84)), url(${verse.backgroundImageUrl})`, backgroundSize: 'cover', color: 'white' } : {}}><blockquote className="serif" style={{ fontSize: '1.15rem', lineHeight: 1.65, margin: 0 }}>“{verse.text}”</blockquote><p className="verse-ref" style={{ marginTop: '1rem' }}>— {verse.reference}</p>{verse.reflection ? <p style={{ marginTop: '.8rem' }}>{verse.reflection}</p> : null}<div className="row" style={{ marginTop: '1rem', gap: '.5rem' }}><Button size="sm" variant="secondary" onClick={() => copy(verse)} iconLeft={<Copy size={14} />}>Copy</Button><Button size="sm" variant="secondary" onClick={() => share(verse)} iconLeft={<Share2 size={14} />}>Share</Button></div></article>)}</div>
  </div></div>;
}
