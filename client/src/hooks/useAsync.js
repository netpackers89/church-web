import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal async data hook with loading/error/data state and a manual reload.
 * Keeps data-fetching logic out of page components and ensures every feature
 * can render loading, empty, and error states consistently.
 *
 *   const { data, loading, error, reload } = useAsync(fn, deps);
 */
export default function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      setState({ data, loading: false, error: null });
    } catch (error) {
      // Endpoint-not-implemented is surfaced as a friendly error, not a crash.
      setState({ data: null, loading: false, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    let active = true;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await fn();
        if (active) setState({ data, loading: false, error: null });
      } catch (error) {
        if (active) setState({ data: null, loading: false, error });
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}

