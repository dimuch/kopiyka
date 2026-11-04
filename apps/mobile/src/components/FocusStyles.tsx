import { createElement } from 'react';
import { Platform } from 'react-native';

/** Web only: what RN styles can't say, because they have no pseudo-states. Rendered once, at the root. */
export function FocusStyles() {
  if (Platform.OS !== 'web') return null;
  // `TextField` shows focus with its border, so the browser's ring would only double it.
  return createElement('style', null, 'input:focus { outline: none; }');
}
