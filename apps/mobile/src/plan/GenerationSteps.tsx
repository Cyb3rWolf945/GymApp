import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';
import type { GenerationStepState } from '@gymapp/shared';
import { en } from '../copy/en';
import { easing, useCountUp, useReducedMotion } from '../motion';
import { motion, useTheme } from '../theme';
import { Text } from '../ui';

const labels = en.plan.generating.steps;

type StepId = 'calories' | 'exercises' | 'meals';

/** "About 2,000 kcal a day", with the number counting up when it first appears. */
function CaloriesNote({ kcal, format }: { kcal: number; format: (kcal: number) => string }) {
  const shown = useCountUp(kcal);
  return <Text variant="small" tone="muted" accessibilityLabel={format(kcal)}>{format(shown)}</Text>;
}

/** The tick that finishes a step pops in. The spinner of the step in progress is the native one. */
function Indicator({ state }: { state: GenerationStepState }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(state === 'done' && !reduced ? 0 : 1)).current;
  const was = useRef(state);
  useEffect(() => {
    if (state === 'done' && (was.current !== 'done' || !reduced)) {
      if (reduced) pop.setValue(1);
      else {
        pop.setValue(0);
        Animated.timing(pop, { toValue: 1, duration: motion.duration.base, easing: easing('enter'), useNativeDriver: true }).start();
      }
    }
    was.current = state;
  }, [state, reduced, pop]);
  if (state === 'active') return <ActivityIndicator color={colors.accentText} />;
  if (state === 'done') {
    const scale = pop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, motion.popScale + 0.1, 1] });
    return (
      <Animated.View style={{ opacity: pop, transform: [{ scale }] }}>
        <Text variant="heading" style={{ color: colors.accentText }}>✓</Text>
      </Animated.View>
    );
  }
  return <Text variant="heading" style={{ color: colors.divider }}>•</Text>;
}

/** A label that breathes while its step is in progress. */
function Label({ id, state }: { id: StepId; state: GenerationStepState }) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== 'active' || reduced) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: motion.duration.slow * 1.5, easing: easing('standard'), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: motion.duration.slow * 1.5, easing: easing('standard'), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, reduced, pulse]);
  return (
    <Animated.View style={{ opacity: pulse }}>
      <Text variant="bodyStrong" tone={state === 'pending' ? 'muted' : 'default'}>{labels[id]}</Text>
    </Animated.View>
  );
}

/**
 * The visible steps: a dot while waiting, a spinner and a breathing label while working, a tick that pops in when
 * done. `calories` can count its number up (`caloriesCount`) or just show a note (`caloriesNote`).
 */
export function GenerationSteps({
  steps,
  caloriesNote,
  caloriesCount,
}: {
  steps: { id: StepId; state: GenerationStepState }[];
  caloriesNote?: string;
  caloriesCount?: { kcal: number; format: (kcal: number) => string };
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.lg }} accessibilityRole="list">
      {steps.map((s) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityLabel={`${labels[s.id]} ${s.state === 'done' ? 'done' : ''}`}>
          <View style={{ width: 28, alignItems: 'center' }}>
            <Indicator state={s.state} />
          </View>
          <View style={{ flex: 1 }}>
            <Label id={s.id} state={s.state} />
            {s.id === 'calories' && s.state === 'done' ? (
              caloriesCount ? <CaloriesNote kcal={caloriesCount.kcal} format={caloriesCount.format} /> : caloriesNote ? <Text variant="small" tone="muted">{caloriesNote}</Text> : null
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
