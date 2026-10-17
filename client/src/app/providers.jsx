import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components/feedback/ToastProvider.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { SettingsProvider } from '../context/SettingsContext.jsx';

/**
 * Composes the application-wide providers in the correct order:
 * Router → Toasts → Auth → Settings. Individual feature pages compose the
 * permission/settings consumers below this boundary.
 */
export default function Providers({ children }) {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

