import { ActivityIndicator, View } from 'react-native';
import type { GenerationStepState } from '@gymapp/shared';
import { en } from '../copy/en';
import { useTheme } from '../theme';
import { Text } from '../ui';

const labels = en.plan.generating.steps;

/** The visible steps: a tick when done, a spinner while working, a dot while waiting. */
export function GenerationSteps({ steps, caloriesNote }: { steps: { id: 'calories' | 'exercises' | 'meals'; state: GenerationStepState }[]; caloriesNote?: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }} accessibilityRole="list">
      {steps.map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLabel={`${labels[s.id]} ${s.state === 'done' ? 'done' : ''}`}>
          <View style={{ width: 28, alignItems: 'center' }}>
            {s.state === 'active' ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text variant="heading" style={{ color: s.state === 'done' ? colors.accent : colors.border }}>{s.state === 'done' ? '✓' : '•'}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" tone={s.state === 'pending' ? 'muted' : 'default'}>{labels[s.id]}</Text>
            {s.id === 'calories' && s.state === 'done' && caloriesNote ? <Text variant="small" tone="muted">{caloriesNote}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
