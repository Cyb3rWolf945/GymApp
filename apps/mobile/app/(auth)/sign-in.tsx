import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { authCopy } from '../../src/auth/copy';
import {
  signInWithAppleToken,
  signInWithMagicLink,
  signInWithOAuth,
  type AuthResult,
  type OAuthProvider,
} from '../../src/auth/authService';
import { isSupabaseConfigured, supabase } from '../../src/supabase';
import { colors } from '../../src/theme';

WebBrowser.maybeCompleteAuthSession();

const isWeb = Platform.OS === 'web';
const redirectTo = isWeb ? window.location.origin : Linking.createURL('auth');

async function openAuthSession(url: string, returnUrl: string): Promise<string | null> {
  const res = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  return res.type === 'success' ? res.url : null;
}

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<AuthResult>) {
    setError(null);
    if (!isSupabaseConfigured) return setError(authCopy.configError);
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error);
      return r;
    } catch {
      setError(authCopy.genericError);
    } finally {
      setBusy(false);
    }
  }

  async function onMagicLink() {
    const r = await run(() => signInWithMagicLink(supabase, email, redirectTo));
    if (r?.ok) setSent(true);
  }

  const onOAuth = (provider: OAuthProvider) =>
    run(() => signInWithOAuth(supabase, provider, redirectTo, isWeb ? undefined : openAuthSession));

  // Native iOS uses the system Sign in with Apple sheet; web/Android use the OAuth flow.
  const onApple = () =>
    Platform.OS === 'ios'
      ? run(async () => {
          try {
            const cred = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
            return signInWithAppleToken(supabase, cred.identityToken);
          } catch {
            return { ok: false as const, error: authCopy.genericError };
          }
        })
      : onOAuth('apple');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{authCopy.title}</Text>
      <Text style={styles.subtitle}>{authCopy.subtitle}</Text>

      {sent ? (
        <Text style={styles.success}>{authCopy.checkInbox}</Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={authCopy.emailPlaceholder}
            placeholderTextColor={colors.muted}
            accessibilityLabel={authCopy.emailLabel}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={onMagicLink}>
            <Text style={styles.primaryText}>{busy ? authCopy.sendingLink : authCopy.sendLink}</Text>
          </Pressable>
        </>
      )}

      <Pressable style={styles.secondary} disabled={busy} onPress={() => onOAuth('google')}>
        <Text style={styles.secondaryText}>{authCopy.google}</Text>
      </Pressable>
      <Pressable style={styles.secondary} disabled={busy} onPress={onApple}>
        <Text style={styles.secondaryText}>{authCopy.apple}</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: colors.background, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { color: colors.accent, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 16, marginBottom: 12 },
  input: { backgroundColor: colors.surface, color: colors.text, padding: 14, borderRadius: 8, fontSize: 16 },
  primary: { backgroundColor: colors.accent, padding: 14, borderRadius: 8, alignItems: 'center' },
  primaryText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
  secondary: { backgroundColor: colors.surface, padding: 14, borderRadius: 8, alignItems: 'center' },
  secondaryText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  success: { color: colors.text, fontSize: 16 },
  error: { color: '#FF6B6B', fontSize: 14 },
});
