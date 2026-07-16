'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Server snapshot is always false (assume desktop) since the server can't
// know viewport size — corrects itself right after hydration. Standard
// tradeoff for viewport-aware JS values that can't be expressed as pure CSS
// (like a numeric grid width).
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
