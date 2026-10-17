import FeatureUnavailable from './FeatureUnavailable.jsx';
import EmptyState from './EmptyState.jsx';
import ErrorMessage from '../feedback/ErrorMessage.jsx';
import { CardSkeleton } from './Skeleton.jsx';

/**
 * Standardized loading / error / empty / data states for a `useAsync` query.
 * When the backend endpoint is not yet implemented (the axios interceptor flags
 * the error with `endpointMissing`), this renders the documented
 * "feature not available" panel instead of a generic error or fake data.
 *
 * Props:
 *   query    { loading, data, error, reload } returned by useAsync
 *   feature  display name for the unavailable panel
 *   endpoint expected endpoint shown in the unavailable panel
 *   skeletonCount grid skeleton count while loading (default 3)
 *   isEmpty   optional (data) => boolean override
 *   emptyState node rendered when the list is empty
 *   children  (data, list) => ReactNode render function
 */
export default function DataState({ query, feature, endpoint, skeletonCount = 3, isEmpty, emptyState, children }) {
  const { loading, data, error, reload } = query;

  if (loading) {
    return (
      <div className="event-grid">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    if (error.endpointMissing) {
      return <FeatureUnavailable feature={feature} endpoint={endpoint} />;
    }
    return <ErrorMessage error={error} onRetry={reload} />;
  }

  const list = Array.isArray(data) ? data : data ? [data] : [];
  if (isEmpty ? isEmpty(data) : list.length === 0) {
    return emptyState ?? <EmptyState title="Nothing here yet" />;
  }
  return children(data, list);
}
