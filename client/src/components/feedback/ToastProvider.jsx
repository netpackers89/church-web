import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

/**
 * Toast notification system. Use the exported `useToast()` hook anywhere in
 * the tree: `const { success, error, info } = useToast(); success('Saved!')`.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone, title, description) => {
    const id = ++toastId;
    setToasts((list) => [...list, { id, tone, title, description }]);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => remove(id), tone === 'error' ? 6500 : 4200);
    }
    return id;
  }, [remove]);

  const value = useMemo(() => ({
    success: (title, description) => push('success', title, description),
    error: (title, description) => push('error', title, description),
    info: (title, description) => push('info', title, description),
    push,
    remove,
  }), [push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const TONE_ICON = { success: CheckCircle2, error: XCircle, info: Info };

function ToastViewport({ toasts, onClose }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Icon = TONE_ICON[t.tone] ?? Info;
        return (
          <div key={t.id} className={`toast toast-${t.tone}`} role="status">
            <span className="t-icon"><Icon size={20} aria-hidden="true" /></span>
            <div className="t-body">
              <strong>{t.title}</strong>
              {t.description ? <p>{t.description}</p> : null}
            </div>
            <button type="button" className="t-close" onClick={() => onClose(t.id)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastProvider;

