import { useCallback, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * A form's error text: `showError` sets it and announces it, `clearError` takes it away. The alert role covers web;
 * VoiceOver needs an explicit announcement.
 */
export function useAnnouncedError(): {
  error: string | null;
  showError: (text: string) => void;
  clearError: () => void;
} {
  const [error, setError] = useState<string | null>(null);
  const showError = useCallback((text: string) => {
    setError(text);
    AccessibilityInfo.announceForAccessibility(text);
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { error, showError, clearError };
}
