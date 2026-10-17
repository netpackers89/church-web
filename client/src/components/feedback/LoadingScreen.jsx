/** Full-screen loading indicator used while restoring a session or bootstrapping. */
export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="loading-block" style={{ minHeight: '100vh' }} role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

