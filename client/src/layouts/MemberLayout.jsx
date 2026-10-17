import { Outlet } from 'react-router-dom';
import PublicNavbar from '../components/layout/PublicNavbar.jsx';
import PublicFooter from '../components/layout/PublicFooter.jsx';

/** Members use the same church website shell as visitors. */
export default function MemberLayout() {
  return (
    <div className="app-shell member-site-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <PublicNavbar />
      <main id="main" className="app-main member-site-main">
        <div className="container member-site-content">
          <Outlet />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

