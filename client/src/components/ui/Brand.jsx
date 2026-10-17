import { Link } from 'react-router-dom';
import { siteConfig } from '../../utils/siteConfig.js';

/**
 * Church brand mark + wordmark. Uses the real logo asset if present in the
 * public folder; otherwise falls back to an elegant monogram so the header is
 * never a broken image. Renders inside headers, footers, and auth screens.
 */
export default function Brand({
  to = '/',
  subtitle = 'Digital Platform',
  logo = '/mulu%20wengel%20logo.png',
  name = siteConfig.churchName,
  monogram = siteConfig.churchMonogram,
  className = '',
}) {
  const inner = (
    <>
      <span className="brand-mark" aria-hidden="true">
        {logo ? <img src={logo} alt="" /> : monogram}
      </span>
      <span className="brand-text">
        <strong>{name}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </>
  );

  const Tag = to ? Link : 'span';
  return (
    <Tag to={to || undefined} className={`brand ${className}`} aria-label={to ? `${name} — home` : undefined}>
      {inner}
    </Tag>
  );
}


