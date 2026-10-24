import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshUser = useCallback(async ({ throwOnError = false } = {}) => {
    try {
      const response = await api.getAuthIdentity();
      const nextUser = response.data.data ?? null;
      setUser(nextUser);
      setError('');
      return nextUser;
    } catch (failure) {
      setUser(null);
      setError(failure.message || 'Your session could not be restored.');
      if (throwOnError) throw failure;
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.getAuthIdentity()
      .then((response) => {
        if (!active) return;
        const profile = response.data?.data ?? null;
        if (profile) setUser(profile);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    await api.login({ email, password });
    const nextUser = await refreshUser({ throwOnError: true });
    return nextUser;
  }, [refreshUser]);

  const register = useCallback(async (payload) => {
    const response = await api.register(payload);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setError('');
  }, []);

  const value = useMemo(() => ({ user, loading, error, login, register, logout, refreshUser, setUser }), [error, loading, login, logout, refreshUser, register, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
