import { type ReactNode, useMemo } from 'react';
import { View } from 'react-native';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { TrackingBanner } from '../src/marketing/TrackingBanner';
import { OfflineBanner } from '../src/net/OfflineBanner';
import { AccountModalProvider } from '../src/onboarding/AccountModalProvider';
import { OnboardingProvider } from '../src/onboarding/OnboardingProvider';
import { useSaveOnboarding } from '../src/onboarding/useSaveOnboarding';
import { AppThemeProvider, navigationTheme, useTheme } from '../src/theme';
import { FadeSlideIn } from '../src/motion';
import { Splash, ToastProvider } from '../src/ui';

// Signed-out visitors start on the landing page (web) or in onboarding (native: the landing page redirects).
export const unstable_settings = { initialRouteName: 'landing' };

/**
 * React Navigation's theme, from the app's active palette (live: it changes with the scheme). Without it every navigator and
 * screen container falls back to the library's light theme, which is the white flash behind a screen that is still mounting.
 */
function NavigationTheme({ children }: { children: ReactNode }) {
  const { scheme } = useTheme();
  const value = useMemo(() => ({ ...DefaultTheme, ...navigationTheme(scheme) }), [scheme]);
  return <NavigationThemeProvider value={value}>{children}</NavigationThemeProvider>;
}

/** Light icons on a dark app, dark icons on a light one. */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootStack() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  useSaveOnboarding();
  // While the session loads: the splash, not a blank screen. The first screen then fades in over the same background.
  if (loading) return <Splash />;
  return (
    <FadeSlideIn style={{ flex: 1 }}>
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
      {/* The quiz is open to everyone: signed in, it fills in what the saved profile is missing (E-73). */}
      <Stack.Screen name="onboarding" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="landing" />
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
    </FadeSlideIn>
  );
}

/** The two typefaces and the icon font, loaded once before the first screen so nothing shows in a fallback face. */
const FONTS = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, ...Ionicons.font };

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <NavigationTheme>
        <FontGate>
          <AppProviders />
        </FontGate>
      </NavigationTheme>
    </AppThemeProvider>
  );
}

/** The splash until the fonts are in; if a font fails to load the app still opens (in the system face), never on a blank screen. */
function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts(FONTS);
  if (!loaded && !error) return <Splash />;
  return <>{children}</>;
}

function AppProviders() {
  const { colors } = useTheme();
  return (
      <ToastProvider>
        <AuthProvider>
          <OnboardingProvider>
            <ThemedStatusBar />
            <AccountModalProvider>
              <View style={{ flex: 1, backgroundColor: colors.background }}>
                <OfflineBanner />
                <RootStack />
              </View>
            </AccountModalProvider>
            <TrackingBanner />
          </OnboardingProvider>
        </AuthProvider>
      </ToastProvider>
  );
}
