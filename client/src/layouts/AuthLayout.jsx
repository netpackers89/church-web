import { Outlet } from 'react-router-dom';

/** Auth shell: full-bleed split-screen pages (Login, Register, Recovery). */
export default function AuthLayout() {
  return (
    <main id="main">
      <Outlet />
    </main>
  );
}

