import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button.jsx';

/**
 * Accessible modal dialog. Closes on Escape and overlay click, traps nothing
 * exotic but focuses the panel on open and restores focus on close.
 */
export default function Modal({ open, onClose, title, description, children, footer, size = '' }) {
  const panelRef = useRef(null);
  const lastActive = useRef(null);
  const onCloseRef = useRef(onClose);

  // Parent pages commonly pass an inline close handler. Keep the latest
  // handler without putting its changing identity in the lifecycle effect:
  // otherwise every controlled-input update tears down the dialog, restores
  // focus, and makes typing appear to stop after one character.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    lastActive.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastActive.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCloseRef.current?.()}>
      <div
        className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {description ? <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.92rem' }}>{description}</p> : null}
          </div>
          <button type="button" className="modal-close" onClick={() => onCloseRef.current?.()} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Confirmation dialog wrapper for destructive actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, loading = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}

