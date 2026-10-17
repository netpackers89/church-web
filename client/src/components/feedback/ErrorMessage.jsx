import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Inline error message with an optional retry action.
 * Accepts an Error object (with status) or a string.
 */
export default function ErrorMessage({ error, onRetry, title = 'Something went wrong' }) {
  const message =
    typeof error === 'string'
      ? error
      : error?.message || 'We couldn\'t load this right now. Please try again.';

  return (
    <div className="alert alert-danger" role="alert">
      <AlertCircle aria-hidden="true" />
      <div style={{ flex: 1 }}>
        <strong>{title}</strong>
        <p style={{ marginTop: '0.2rem' }}>{message}</p>
        {onRetry ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry} style={{ marginTop: '0.5rem', paddingInline: 0 }}>
            <RefreshCw className="btn-icon" aria-hidden="true" /> Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

