import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useReducedMotion } from '../../src/motion';
import { useTheme } from '../../src/theme';
import { WorkoutProvider } from '../../src/workout/WorkoutProvider';

export default function AppLayout() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const web = Platform.OS === 'web';
  // Stack screens: a platform push on a phone (slide from the right, Back reverses), a fade on the web. With reduced motion
  // only a short fade. Detail screens opened from a card (recipe, exercise, a past workout) rise like a sheet.
  const push = reduced || web ? 'fade' : 'default';
  const sheet = reduced || web ? 'fade' : 'slide_from_bottom';
  return (
    <WorkoutProvider>
      <Stack screenOptions={{ headerShown: false, animation: push, animationDuration: reduced ? 120 : 250, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="recipe/[slug]" options={{ animation: sheet }} />
        <Stack.Screen name="exercise/[slug]" options={{ animation: sheet }} />
        <Stack.Screen name="history/[id]" options={{ animation: sheet }} />
      </Stack>
    </WorkoutProvider>
  );
}
