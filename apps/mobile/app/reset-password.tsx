import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { exchangeCode, updatePassword } from '../src/auth/authService';
import { authCopy } from '../src/auth/copy';
import { mapAuthError } from '../src/auth/errors';
import { parseAuthCallback } from '../src/auth/logic';
import { supabase } from '../src/supabase';
import { useTheme } from '../src/theme';
import { Button, Screen, Text, TextField, useToast } from '../src/ui';

/**
 * Opened by the "reset your password" email. The link carries a code: trade it for a session, then ask for the new
 * password. Public (not under `(auth)`): once the code is exchanged you are signed in, which would hide `(auth)` screens.
 */
export default function ResetPassword() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { session } = useAuth();
  const nativeUrl = Linking.useURL();
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const href = Platform.OS === 'web' ? window.location.href : nativeUrl;
    if (!href || started.current) return;
    started.current = true;
    void (async () => {
      const callback = parseAuthCallback(href);
      if (callback.error) return setLinkError(mapAuthError({ code: callback.errorCode, message: callback.error }).message);
      if ((await supabase.auth.getSession()).data.session) return;
      if (!callback.code) return setLinkError(authCopy.callbackFailed);
      const result = await exchangeCode(supabase, callback.code);
      if (!result.ok && !(await supabase.auth.getSession()).data.session) setLinkError(result.error);
    })();
  }, [nativeUrl]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await updatePassword(supabase, password);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast.show(authCopy.newPasswordDone, 'success');
    router.replace('/');
  };

  if (linkError) {
    return (
      <Screen center framed>
        <Text variant="heading" tone="danger" accessibilityRole="alert">{linkError}</Text>
        <Button label={authCopy.modes.logIn} onPress={() => router.replace('/sign-in?mode=login')} />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen center framed>
        <ActivityIndicator color={colors.accentText} />
        <Text tone="muted" accessibilityLiveRegion="polite">{authCopy.callbackWorking}</Text>
      </Screen>
    );
  }
  return (
    <Screen center framed keyboardTaps>
      <Text variant="display" accessibilityRole="header">{authCopy.newPasswordTitle}</Text>
      <TextField
        value={password}
        onChangeText={setPassword}
        placeholder={authCopy.passwordPlaceholder}
        accessibilityLabel={authCopy.newPasswordLabel}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={() => void save()}
        style={{ minHeight: 52, textAlignVertical: 'center' }}
      />
      <Button label={show ? authCopy.hidePassword : authCopy.showPassword} variant="ghost" onPress={() => setShow((v) => !v)} />
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
      <Button label={authCopy.newPasswordSave} loading={busy} onPress={() => void save()} />
    </Screen>
  );
}
