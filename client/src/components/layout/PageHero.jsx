import { churchName } from '../../utils/siteConfig.js';

const PAGE_IMAGES = [
  { match: 'about', image: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1920&q=85' },
  { match: 'program', image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1920&q=85' },
  { match: 'event', image: 'https://images.unsplash.com/photo-1508997449629-303059a039c0?auto=format&fit=crop&w=1920&q=85' },
  { match: 'giving', image: 'https://images.unsplash.com/photo-1593113630400-ea4288922497?auto=format&fit=crop&w=1920&q=85' },
  { match: 'campaign', image: 'https://images.unsplash.com/photo-1593113646773-028c64a8f1b8?auto=format&fit=crop&w=1920&q=85' },
  { match: 'new creation', image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=85' },
  { match: 'new christian', image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1920&q=85' },
  { match: 'announcement', image: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1920&q=85' },
  { match: 'bible study', image: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1920&q=85' },
  { match: 'scripture', image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1920&q=85' },
  { match: 'ministry', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=85' },
  { match: 'sermon', image: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1920&q=85' },
];

/** Compact page banner for secondary public pages (About, Events, Contact…). */
export default function PageHero({ eyebrow, title, subtitle, imageUrl }) {
  const pageDescription = `${eyebrow || ''} ${title || ''}`.toLowerCase();
  const pageImage = PAGE_IMAGES.find(({ match }) => pageDescription.includes(match))?.image;

  return (
    <section className="hero page-hero" style={{ minHeight: 'auto' }}>
      <div className="hero-media">
        <img
          src={imageUrl || pageImage || 'https://images.unsplash.com/photo-1519491050282-cf00c82424b4?auto=format&fit=crop&w=1920&q=85'}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <div className="container-wide" style={{ position: 'relative', zIndex: 1 }}>
        <div className="hero-inner" style={{ minHeight: 'clamp(16rem, 32vh, 22rem)', gridTemplateColumns: '1fr' }}>
          <div>
            <span className="eyebrow">
              <span className="dot" /> {eyebrow || churchName}
            </span>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)' }}>{title}</h1>
            {subtitle ? <p className="hero-sub">{subtitle}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
