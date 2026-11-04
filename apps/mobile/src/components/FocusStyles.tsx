import { createElement } from 'react';
import { Platform } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';

/** Web only: what RN styles can't say, because they have no pseudo-states. Rendered once, at the root. */
export function FocusStyles() {
  const colors = useColors();
  if (Platform.OS !== 'web') return null;
  // `TextField` shows focus with its border, so the browser's ring would only double it. The keyboard ring is inset
  // because full-width buttons touch their ScrollView's clipped edge, and the band keeps it visible on accent fills.
  const css = `
    input:focus { outline: none; }
    :not(input):focus-visible {
      outline: 2px solid ${colors.accent};
      outline-offset: -2px;
      box-shadow: inset 0 0 0 4px ${colors.bg};
    }
  `;
  return createElement('style', null, css);
}
