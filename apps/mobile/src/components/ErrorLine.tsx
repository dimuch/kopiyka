import { Text } from '@/components/Text';

/** A form's error line, read out as an alert; nothing when there's no error (null or empty). */
export function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <Text accessibilityRole="alert" variant="label" color="danger">
      {text}
    </Text>
  ) : null;
}
