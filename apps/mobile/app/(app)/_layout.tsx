import { Stack } from 'expo-router';
import { colors } from '../../src/theme';
import { WorkoutProvider } from '../../src/workout/WorkoutProvider';

export default function AppLayout() {
  return (
    <WorkoutProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </WorkoutProvider>
  );
}
