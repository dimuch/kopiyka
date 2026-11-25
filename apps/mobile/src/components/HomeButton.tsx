import { router } from 'expo-router';
import { IconButton } from '@/components/IconButton';

/** The header's house button: same action as the Home tab icon — switches tabs, pushes nothing. */
export function HomeButton() {
  return <IconButton icon="home" label="Home" tone="muted" onPress={() => router.navigate('/')} />;
}
