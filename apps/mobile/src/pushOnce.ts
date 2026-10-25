import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * `router.push` for a button that opens a screen, ignoring further presses until this screen gains focus again.
 * The pushed screen takes focus only after a re-render, so two presses in one tick would otherwise push it twice.
 */
export function usePushOnce(): (href: Href) => void {
  const pushed = useRef(false);

  // Back on this screen (or first shown): the button opens its screen again.
  useFocusEffect(
    useCallback(() => {
      pushed.current = false;
    }, []),
  );

  return useCallback((href: Href) => {
    if (pushed.current) return;
    pushed.current = true;
    router.push(href);
  }, []);
}
