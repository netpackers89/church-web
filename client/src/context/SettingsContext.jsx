import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const STORAGE_KEY = 'church_calendar_pref';
const THEME_STORAGE_KEY = 'church_theme_pref';

/**
 * User preferences that apply across the app: Ethiopian/Gregorian calendar
 * display, timezone, and language. The calendar preference is persisted to the
 * profile where the backend supports it and mirrored in localStorage so it
 * survives a reload before hydration.
 */
const SettingsContext = createContext(null);

export const STAFF_ROLES = ['ADMIN', 'PASTOR', 'FINANCE', 'LEADER', 'REGISTRAR'];

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [calendar, setCalendar] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'gregorian';
    } catch {
      return 'gregorian';
    }
  });
  const [language, setLanguage] = useState(() => user?.preferredLanguage || 'en');
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  // Keep `language` in sync with the server profile as it loads.
  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== language) {
      setLanguage(user.preferredLanguage);
    }
  }, [user, language]);

  const isEthiopian = calendar === 'ethiopian';

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
    };
    applyTheme();
    if (theme !== 'system') return undefined;
    media.addEventListener?.('change', applyTheme);
    return () => media.removeEventListener?.('change', applyTheme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    if (!['light', 'dark', 'system'].includes(nextTheme)) return;
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the preference for this session if storage is unavailable.
    }
  }, []);

  const toggleCalendar = useCallback(async () => {
    const next = isEthiopian ? 'gregorian' : 'ethiopian';
    setCalendar(next);
    // Persist locally so the choice survives reloads and offline sessions.
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable; preference stays for this session */
    }
    // NOTE: The backend profile update endpoint does not yet expose a
    // calendar-preference field, so we do not attempt to PATCH it (an unknown
    // field would be rejected). The preference is stored client-side until a
    // documented settings endpoint is available. See BACKEND_DEPENDENCIES.md.
  }, [isEthiopian]);

  const value = useMemo(
    () => ({ calendar, isEthiopian, toggleCalendar, language, setLanguage, timezone, theme, setTheme }),
    [calendar, isEthiopian, toggleCalendar, language, timezone, theme, setTheme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

