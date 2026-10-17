import { Outlet } from 'react-router-dom';
import PublicNavbar from '../components/layout/PublicNavbar.jsx';
import PublicFooter from '../components/layout/PublicFooter.jsx';

/** Public website shell: header, routed content, footer. No auth required. */
export default function PublicLayout() {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <PublicNavbar />
      <main id="main" className="app-main">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

