import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { exchangeCode } from '../src/auth/authService';
import { authCopy } from '../src/auth/copy';
import { mapAuthError } from '../src/auth/errors';
import { parseAuthCallback } from '../src/auth/logic';
import { supabase } from '../src/supabase';
import { useTheme } from '../src/theme';
import { Button, Screen, Text } from '../src/ui';

/**
 * Where email links and OAuth come back to: `https://app/auth?code=…` on web, `fuelift://auth?code=…` on the phone.
 * Trades the code for a session, then opens the app. Errors arrive in the URL (`#error=…`) and are shown in plain words.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { colors } = useTheme();
  const nativeUrl = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const href = Platform.OS === 'web' ? window.location.href : nativeUrl;
    if (!href || started.current) return; // on the phone the URL arrives a moment after the screen opens
    started.current = true;
    void (async () => {
      const callback = parseAuthCallback(href);
      if (callback.error) return setError(mapAuthError({ code: callback.errorCode, message: callback.error }).message);
      // On web the Supabase client may already have used the code (detectSessionInUrl): a session is then enough.
      const open = () => router.replace('/');
      if ((await supabase.auth.getSession()).data.session) return open();
      if (!callback.code) return setError(authCopy.callbackFailed);
      const result = await exchangeCode(supabase, callback.code);
      if (result.ok || (await supabase.auth.getSession()).data.session) return open();
      setError(result.error);
    })();
  }, [nativeUrl, router]);

  return (
    <Screen center framed>
      {error ? (
        <>
          <Text variant="heading" tone="danger" accessibilityRole="alert">{error}</Text>
          <Button label={authCopy.modes.logIn} onPress={() => router.replace('/sign-in?mode=login')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text tone="muted" accessibilityLiveRegion="polite">{authCopy.callbackWorking}</Text>
        </>
      )}
    </Screen>
  );
}
