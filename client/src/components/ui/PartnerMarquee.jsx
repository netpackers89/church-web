import { useMemo } from 'react';
import { publicService, unwrap } from '../../services/api.js';
import useAsync from '../../hooks/useAsync.js';

/**
 * Continuous, seamless horizontal marquee for sister churches and partner
 * ministries. Loads organizations from the public API; falls back to an
 * intentionally-empty, graceful state (no fabricated real partners).
 *
 * - Duplicates the sequence once for a seamless loop (translateX -50%).
 * - Pauses on hover; respects prefers-reduced-motion (see index.css).
 * - Consistent logo box + vertical alignment; links only when a valid,
 *   authorized URL exists.
 */
export default function PartnerMarquee({ variant = 'light' }) {
  const { data, loading } = useAsync(async () => {
    const res = await publicService.partners();
    return unwrap(res) ?? [];
  }, []);

  const partners = Array.isArray(data) ? data : [];

  const groups = useMemo(() => {
    if (partners.length === 0) return [];
    // Two identical groups create the seamless -50% loop.
    return [0, 1].map((g) => (
      <div className="marquee-group" key={g} aria-hidden={g === 1 ? 'true' : undefined}>
        {partners.map((p, i) => (
          <PartnerItem key={`${p.id ?? p.name}-${i}`} partner={p} onDark={variant === 'dark'} />
        ))}
      </div>
    ));
  }, [partners, variant]);

  if (loading) {
    return (
      <div className="container">
        <div className="skeleton" style={{ height: '3.6rem', borderRadius: 'var(--r-md)' }} />
      </div>
    );
  }

  // Graceful fallback: no public partners endpoint/populated data yet.
  if (partners.length === 0) return null;

  return (
    <div className={`marquee ${variant === 'dark' ? 'on-navy' : ''}`} role="region" aria-label="Partner organizations">
      <span className="marquee-fade left" aria-hidden="true" />
      <span className="marquee-fade right" aria-hidden="true" />
      <div className="marquee-track">{groups}</div>
    </div>
  );
}

function PartnerItem({ partner, onDark }) {
  const initials = (partner.name || '?')
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const logo = (
    <span className="marquee-logo" aria-hidden="true">
      {partner.logoUrl ? <img src={partner.logoUrl} alt="" loading="lazy" /> : initials}
    </span>
  );

  return (
    <span className={`marquee-item ${onDark ? 'on-dark' : ''}`}>
      {partner.websiteUrl ? (
        <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.85rem' }}>
          {logo}
          <span className="marquee-name">{partner.name}</span>
        </a>
      ) : (
        <>
          {logo}
          <span className="marquee-name">{partner.name}</span>
        </>
      )}
    </span>
  );
}

