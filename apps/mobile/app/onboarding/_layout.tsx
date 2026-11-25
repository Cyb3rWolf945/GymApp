import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }} />;
}
