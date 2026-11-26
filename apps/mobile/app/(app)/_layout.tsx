import { Stack } from 'expo-router';
import { useReducedMotion } from '../../src/motion';
import { useTheme } from '../../src/theme';
import { WorkoutProvider } from '../../src/workout/WorkoutProvider';

export default function AppLayout() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <WorkoutProvider>
      <Stack screenOptions={{ headerShown: false, animation: reduced ? 'none' : 'default', contentStyle: { backgroundColor: colors.background } }} />
    </WorkoutProvider>
  );
}
