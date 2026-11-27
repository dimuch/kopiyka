import type { ReactNode } from 'react';
import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/appearance/AppearanceContext';
import { LoadError } from '@/components/LoadError';

/**
 * A screen's loaded data, with its other states: a spinner until it first loads, `loadMessage` with Retry when that
 * load failed, and a "Couldn't refresh" line above the data when a later reload failed.
 */
export function LoadState<T>({
  data,
  error,
  onRetry,
  loadMessage,
  spinnerStyle,
  children,
}: {
  data: T | null;
  error: boolean;
  onRetry: () => void;
  loadMessage: string;
  spinnerStyle: StyleProp<ViewStyle>;
  children: (data: T) => ReactNode;
}) {
  const colors = useColors();
  if (data === null) {
    return error ? (
      <LoadError message={loadMessage} onRetry={onRetry} />
    ) : (
      <ActivityIndicator color={colors.accent} style={spinnerStyle} />
    );
  }
  return (
    <>
      {error && <LoadError message="Couldn’t refresh. Check your connection and try again." onRetry={onRetry} />}
      {children(data)}
    </>
  );
}
