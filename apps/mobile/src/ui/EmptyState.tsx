import { View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Illustration, type IllustrationKind } from './Illustration';
import { Text } from './Text';

/**
 * An invitation, not an error: "No workouts yet. Your first one takes 40 min." With a picture for the topic (`kind`):
 * the same frame everywhere, so empty, missing and failed states all look like part of the app.
 */
export function EmptyState({ title, body, actionLabel, onAction, kind = 'empty' }: { title: string; body?: string; actionLabel?: string; onAction?: () => void; kind?: IllustrationKind }) {
  const { spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xxl }}>
      <Illustration kind={kind} />
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      {body ? <Text tone="muted" style={{ textAlign: 'center' }}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}
