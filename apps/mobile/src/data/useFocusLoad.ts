import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Loads `load()` whenever the screen comes into focus and on `reload`, for the data `key` names (a ledger, month…).
 * `value` is null until that key has loaded; another key reads as loading, and a failed refetch keeps the value already
 * shown and sets `error`. `load` must change only when `key` does (wrap it in `useCallback`), or every render reloads.
 */
export function useFocusLoad<T extends object>(key: string, load: () => Promise<T>) {
  // Tagged with what they're for, so another key reads as loading and Retry clears the error at once, without
  // resetting state inside the effect. A reload is a new attempt, so its fetch is cancelled like a focus one and its
  // error is its own.
  const [version, setVersion] = useState(0);
  const attempt = `${key}#${version}`;
  const [loaded, setLoaded] = useState<{ key: string; value: T } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      load()
        .then((value) => {
          if (!live) return;
          setLoaded({ key, value });
          setFailed(null);
        })
        .catch(() => live && setFailed(attempt));
      return () => {
        live = false;
      };
    }, [key, attempt, load]),
  );

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  return { value: loaded?.key === key ? loaded.value : null, error: failed === attempt, reload };
}
