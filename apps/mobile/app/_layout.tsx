import { View } from 'react-native';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { TrackingBanner } from '../src/marketing/TrackingBanner';
import { OfflineBanner } from '../src/net/OfflineBanner';
import { AccountModalProvider } from '../src/onboarding/AccountModalProvider';
import { OnboardingProvider } from '../src/onboarding/OnboardingProvider';
import { useSaveOnboarding } from '../src/onboarding/useSaveOnboarding';
import { AppThemeProvider, useTheme } from '../src/theme';
import { ToastProvider } from '../src/ui';

// Signed-out visitors start on the landing page (web) or in onboarding (native: the landing page redirects).
export const unstable_settings = { initialRouteName: 'landing' };

/** Light icons on a dark app, dark icons on a light one. */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootStack() {
  const { session, loading } = useAuth();
  const { colors } = useTheme();
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

/** The two typefaces and the icon font, loaded once before the first screen so nothing shows in a fallback face. */
const FONTS = { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, ...Ionicons.font };

export default function RootLayout() {
  const [loaded, error] = useFonts(FONTS);
  // If a font fails to load the app still opens (in the system face); it never sits on a blank screen.
  if (!loaded && !error) return null;
  return (
    <AppThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <OnboardingProvider>
            <ThemedStatusBar />
            <AccountModalProvider>
              <View style={{ flex: 1 }}>
                <OfflineBanner />
                <RootStack />
              </View>
            </AccountModalProvider>
            <TrackingBanner />
          </OnboardingProvider>
        </AuthProvider>
      </ToastProvider>
    </AppThemeProvider>
  );
}
