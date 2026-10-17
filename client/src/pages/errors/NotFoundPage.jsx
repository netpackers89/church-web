import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';

export default function NotFoundPage() {
  return (
    <div className="app-main" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', padding: '3rem 1.25rem' }}>
      <div className="center" style={{ maxWidth: '32rem' }}>
        <span className="eyebrow blue"><span className="dot" /> 404</span>
        <h1 className="serif" style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', marginTop: '0.7rem' }}>Page not found</h1>
        <p className="lead" style={{ marginTop: '0.9rem' }}>
          The page you are looking for doesn't exist or may have been moved.
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1.6rem', flexWrap: 'wrap', gap: '0.7rem' }}>
          <Button to="/" iconRight={Home}>Back home</Button>
          <Button to="/events" variant="secondary" iconLeft={ArrowLeft}>Browse events</Button>
        </div>
        <p className="muted" style={{ marginTop: '2rem', fontSize: '0.88rem' }}>
          Need help? <Link to="/contact" style={{ color: 'var(--blue)', fontWeight: 700 }}>Contact the church office</Link>.
        </p>
      </div>
    </div>
  );
}