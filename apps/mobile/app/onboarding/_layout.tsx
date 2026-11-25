import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme';

/**
 * Steps animate themselves (`[step].tsx`: slide and fade in the direction you are going), which works the same on iOS,
 * Android and the web. The step to "Building your plan…" cross-fades on the phone; on the web that screen fades itself in.
 */
export default function OnboardingLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="generating" options={{ animation: 'fade' }} />
    </Stack>
  );
}
