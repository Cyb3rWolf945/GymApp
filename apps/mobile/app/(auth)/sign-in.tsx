import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { authCopy } from '../../src/auth/copy';
import {
  type AuthResult,
  type OAuthProvider,
  resendConfirmation,
  sendEmailCode,
  sendPasswordReset,
  signInWithAppleToken,
  signInWithOAuth,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
} from '../../src/auth/authService';
import type { AuthErrorKind } from '../../src/auth/errors';
import { cleanCode } from '../../src/auth/logic';
import { authRedirect, oauthEnabled } from '../../src/auth/redirects';
import { useResendWait } from '../../src/auth/useCountdown';
import { isSupabaseConfigured, supabase } from '../../src/supabase';
import { Button, Screen, Text, TextField } from '../../src/ui';

WebBrowser.maybeCompleteAuthSession();

const isWeb = Platform.OS === 'web';

async function openAuthSession(url: string, returnUrl: string): Promise<string | null> {
  const res = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  return res.type === 'success' ? res.url : null;
}

type Mode = 'signUp' | 'logIn';
/** form = email + password; confirm = "check your inbox"; code = email me a code; reset = forgot password. */
type Step = 'form' | 'confirm' | 'code' | 'reset';

const field = { minHeight: 52, textAlignVertical: 'center' as const };

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'login' ? 'logIn' : 'signUp');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; kind?: AuthErrorKind } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const wait = useResendWait(sentAt);

  const go = (next: Step) => {
    setStep(next);
    setError(null);
    setNotice(null);
  };

  /** Runs one auth call with the busy flag and error handling shared by every button. */
  async function run<T extends AuthResult | { ok: true; needsConfirmation: boolean } | { ok: false; error: string; kind?: AuthErrorKind }>(fn: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    setNotice(null);
    if (!isSupabaseConfigured) {
      setError({ message: authCopy.configError });
      return undefined;
    }
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) setError({ message: r.error, kind: r.kind });
      return r;
    } catch {
      setError({ message: authCopy.genericError });
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const submit = async () => {
    if (mode === 'signUp') {
      const r = await run(() => signUpWithPassword(supabase, email, password, authRedirect('auth')));
      if (r?.ok && r.needsConfirmation) {
        setSentAt(Date.now());
        go('confirm');
      }
    } else {
      await run(() => signInWithPassword(supabase, email, password)); // on success the session starts and the app opens
    }
  };

  const resend = async () => {
    const r = await run(() => resendConfirmation(supabase, email, authRedirect('auth')));
    if (r?.ok) {
      setSentAt(Date.now());
      setNotice(authCopy.resent);
    }
  };

  const sendCode = async () => {
    const r = await run(() => sendEmailCode(supabase, email));
    if (r?.ok) setCodeSent(true);
  };
  const verifyCode = () => run(() => verifyEmailCode(supabase, email, code));

  const sendReset = async () => {
    const r = await run(() => sendPasswordReset(supabase, email, authRedirect('reset-password')));
    if (r?.ok) setNotice(authCopy.resetSent);
  };

  const onOAuth = (provider: OAuthProvider) => run(() => signInWithOAuth(supabase, provider, authRedirect('auth'), isWeb ? undefined : openAuthSession));
  // Native iOS uses the system Sign in with Apple sheet; web/Android use the OAuth flow.
  const onApple = () =>
    Platform.OS === 'ios'
      ? run(async () => {
          try {
            const cred = await AppleAuthentication.signInAsync({
              requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
            });
            return signInWithAppleToken(supabase, cred.identityToken);
          } catch {
            return { ok: false as const, error: authCopy.genericError };
          }
        })
      : onOAuth('apple');

  const emailField = (
    <TextField
      value={email}
      onChangeText={setEmail}
      placeholder={authCopy.emailPlaceholder}
      accessibilityLabel={authCopy.emailLabel}
      autoCapitalize="none"
      autoComplete="email"
      autoCorrect={false}
      keyboardType="email-address"
      textContentType="emailAddress"
      style={field}
    />
  );

  const errorBlock = error ? (
    <View style={{ gap: 8 }}>
      <Text tone="danger" accessibilityRole="alert">{error.message}</Text>
      {error.kind === 'email_not_confirmed' ? <Button label={authCopy.resend} variant="secondary" loading={busy} disabled={wait > 0} onPress={() => void resend()} /> : null}
      {error.kind === 'already_registered' ? <Button label={authCopy.modes.logIn} variant="secondary" onPress={() => { setMode('logIn'); setError(null); }} /> : null}
    </View>
  ) : null;

  if (step === 'confirm') {
    return (
      <Screen center framed keyboardTaps>
        <Text variant="display" accessibilityRole="header">{authCopy.confirmTitle}</Text>
        <Text tone="muted">{authCopy.confirmBody(email.trim())}</Text>
        <Button label={wait > 0 ? authCopy.resendIn(wait) : authCopy.resend} variant="secondary" loading={busy} disabled={wait > 0} onPress={() => void resend()} />
        {notice ? <Text tone="accent" accessibilityLiveRegion="polite">{notice}</Text> : null}
        {errorBlock}
        <Button label={authCopy.backToLogIn} variant="ghost" onPress={() => { setMode('logIn'); go('form'); }} />
      </Screen>
    );
  }

  if (step === 'reset') {
    return (
      <Screen center framed keyboardTaps>
        <Text variant="display" accessibilityRole="header">{authCopy.resetTitle}</Text>
        <Text tone="muted">{authCopy.resetBody}</Text>
        {emailField}
        <Button label={authCopy.resetSend} loading={busy} onPress={() => void sendReset()} />
        {notice ? <Text tone="accent" accessibilityLiveRegion="polite">{notice}</Text> : null}
        {errorBlock}
        <Button label={authCopy.backToLogIn} variant="ghost" onPress={() => go('form')} />
      </Screen>
    );
  }

  if (step === 'code') {
    return (
      <Screen center framed keyboardTaps>
        <Text variant="display" accessibilityRole="header">{authCopy.codeOption}</Text>
        {codeSent ? (
          <>
            <Text tone="muted">{authCopy.codeSent(email.trim())}</Text>
            <TextField
              value={code}
              onChangeText={(v) => setCode(cleanCode(v))}
              placeholder={authCopy.codePlaceholder}
              accessibilityLabel={authCopy.codeLabel}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              style={field}
            />
            <Button label={authCopy.codeSubmit} loading={busy} onPress={() => void verifyCode()} />
            <Button label={authCopy.codeBack} variant="ghost" onPress={() => { setCodeSent(false); setCode(''); setError(null); }} />
          </>
        ) : (
          <>
            {emailField}
            <Button label={authCopy.codeSend} loading={busy} onPress={() => void sendCode()} />
          </>
        )}
        {errorBlock}
        <Button label={authCopy.backToLogIn} variant="ghost" onPress={() => go('form')} />
      </Screen>
    );
  }

  return (
    <Screen center framed keyboardTaps>
      <View style={{ gap: 8 }}>
        <Text variant="display" accessibilityRole="header">{authCopy.title}</Text>
        <Text tone="muted">{authCopy.subtitle}</Text>
      </View>

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
        {(['signUp', 'logIn'] as const).map((m) => (
          <View key={m} style={{ flex: 1 }}>
            <Button
              label={authCopy.modes[m]}
              variant={mode === m ? 'primary' : 'secondary'}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              aria-selected={mode === m}
              onPress={() => { setMode(m); setError(null); }}
            />
          </View>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        {emailField}
        <TextField
          value={password}
          onChangeText={setPassword}
          placeholder={authCopy.passwordPlaceholder}
          accessibilityLabel={authCopy.passwordLabel}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          onSubmitEditing={() => void submit()}
          style={field}
        />
        <Button label={showPassword ? authCopy.hidePassword : authCopy.showPassword} variant="ghost" onPress={() => setShowPassword((v) => !v)} />
        <Button
          label={busy ? (mode === 'signUp' ? authCopy.creatingAccount : authCopy.loggingIn) : mode === 'signUp' ? authCopy.createAccount : authCopy.logIn}
          loading={busy}
          onPress={() => void submit()}
        />
        {errorBlock}
        {mode === 'logIn' ? <Button label={authCopy.forgotPassword} variant="ghost" onPress={() => go('reset')} /> : null}
        <Button label={authCopy.codeOption} variant="ghost" onPress={() => go('code')} />
      </View>

      {oauthEnabled.google || oauthEnabled.apple ? (
        <View style={{ gap: 8 }}>
          {oauthEnabled.google ? <Button label={authCopy.google} variant="secondary" disabled={busy} onPress={() => void onOAuth('google')} /> : null}
          {oauthEnabled.apple ? <Button label={authCopy.apple} variant="secondary" disabled={busy} onPress={() => void onApple()} /> : null}
        </View>
      ) : null}
    </Screen>
  );
}
