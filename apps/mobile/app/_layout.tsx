import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { TrackingBanner } from '../src/marketing/TrackingBanner';
import { OnboardingProvider } from '../src/onboarding/OnboardingProvider';
import { useSaveOnboarding } from '../src/onboarding/useSaveOnboarding';
import { ThemeProvider, colors } from '../src/theme';
import { ToastProvider } from '../src/ui';

// Signed-out visitors start on the landing page (web) or in onboarding (native: the landing page redirects).
export const unstable_settings = { initialRouteName: 'landing' };

function RootStack() {
  const { session, loading } = useAuth();
  useSaveOnboarding();
  if (loading) return null;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* Legal pages are public: onboarding (signed out) and Settings (signed in) both link to them. */}
      <Stack.Screen name="legal/[doc]" />
      {/* Email links and OAuth come back here, signed in or out: they create the session. */}
      <Stack.Screen name="auth" />
      <Stack.Screen name="reset-password" />
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="landing" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider scheme="dark">
      <ToastProvider>
        <AuthProvider>
          <OnboardingProvider>
            <StatusBar style="light" />
            <RootStack />
            <TrackingBanner />
          </OnboardingProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
