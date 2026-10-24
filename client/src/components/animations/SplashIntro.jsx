import { useEffect, useState } from 'react';
import logoSvg from '../../assets/mulu-wengel-logo.svg?raw';
import './SplashIntro.css';

const DISPLAY_DURATION_MS = 4000;
const OUTRO_DURATION_MS = 400;
const INTRO_DURATION_MS = DISPLAY_DURATION_MS - OUTRO_DURATION_MS;
const FIRST_VISIT_KEY = 'church.splash-intro.seen';
const logoMarkup = logoSvg.replace(/^<\?xml[^>]*>\s*/, '');

function shouldShowOnLoad() {
  const navigation = window.performance.getEntriesByType('navigation')[0];
  return window.localStorage.getItem(FIRST_VISIT_KEY) !== 'true'
    || navigation?.type === 'reload';
}

export default function SplashIntro() {
  const [phase, setPhase] = useState(() => (shouldShowOnLoad() ? 'intro' : 'hidden'));
  const [runId, setRunId] = useState(0);
  const visible = phase !== 'hidden';
  const exiting = phase === 'outro';

  useEffect(() => {
    window.localStorage.setItem(FIRST_VISIT_KEY, 'true');
  }, []);

  useEffect(() => {
    function showIntro() {
      setRunId((current) => current + 1);
      setPhase('intro');
    }
    window.addEventListener('church:splash-intro', showIntro);
    return () => window.removeEventListener('church:splash-intro', showIntro);
  }, []);

  useEffect(() => {
    if (!visible || exiting) return undefined;
    const timer = window.setTimeout(() => setPhase('outro'), INTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, runId, visible]);

  useEffect(() => {
    if (!exiting) return undefined;
    const timer = window.setTimeout(() => setPhase('hidden'), OUTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, runId]);

  if (!visible) return null;

  return (
    <div
      key={runId}
      className={`splash-intro${exiting ? ' is-exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-labelledby="splash-title"
    >
      <div className="splash-intro-content">
        <div
          className="splash-logo-mark"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: logoMarkup }}
        />
        <h1 id="splash-title" className="splash-title">YEKA ABADO MULU WENGEL</h1>
        <p className="splash-subtitle">Welcome to Our Digital Community</p>
        <div className="splash-progress" aria-hidden="true">
          <span style={{ animationDuration: `${INTRO_DURATION_MS}ms` }} />
        </div>
      </div>
    </div>
  );
}
