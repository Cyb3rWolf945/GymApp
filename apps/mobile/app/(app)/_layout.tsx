import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme';
import { WorkoutProvider } from '../../src/workout/WorkoutProvider';

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <WorkoutProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </WorkoutProvider>
  );
}
