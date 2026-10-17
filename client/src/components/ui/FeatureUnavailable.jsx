import { PlugZap } from 'lucide-react';
import Alert from './Alert.jsx';

/**
 * Shown when a page/feature's backend endpoint is not yet implemented.
 * Clearly communicates the dependency instead of showing fake data.
 * See BACKEND_DEPENDENCIES.md for the full list of pending endpoints.
 */
export default function FeatureUnavailable({ feature, endpoint }) {
  return (
    <div className="empty-state">
      <div className="es-icon">
        <PlugZap size={24} aria-hidden="true" />
      </div>
      <h3>{feature} is coming soon</h3>
      <p>
        This section is ready in the interface but is not yet connected to a live
        server endpoint. Once the backend endpoint is available, content will load
        here automatically.
      </p>
      {endpoint ? (
        <div style={{ marginTop: '0.5rem', maxWidth: '32rem' }}>
          <Alert variant="warning">
            <span>
              Documented dependency — expected endpoint: <code>{endpoint}</code>
            </span>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
