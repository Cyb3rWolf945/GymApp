import { useState } from 'react';
import { Platform, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { authCopy } from './copy';
import {
  type AuthResult,
  type OAuthProvider,
  resendConfirmation,
  sendEmailCode,
  sendPasswordReset,
  saveAppleName,
  signInWithAppleToken,
  signInWithGoogleToken,
  signInWithOAuth,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
} from './authService';
import type { AuthErrorKind } from './errors';
import { cleanCode, visibleProviders } from './logic';
import { nativeApple, nativeGoogle, googleNativeConfigured } from './nativeSignIn';
import { ProviderButton } from './ProviderButton';
import { authRedirect, oauthEnabled } from './redirects';
import { useResendWait } from './useCountdown';
import { isSupabaseConfigured, supabase } from '../supabase';
import { Button, Text, TextField } from '../ui';

WebBrowser.maybeCompleteAuthSession();

const isWeb = Platform.OS === 'web';

async function openAuthSession(url: string, returnUrl: string): Promise<string | null> {
  const res = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  return res.type === 'success' ? res.url : null;
}

export type Mode = 'signUp' | 'logIn';
/** form = email + password; confirm = "check your inbox"; code = email me a code; reset = forgot password. */
type Step = 'form' | 'confirm' | 'code' | 'reset';

const field = { minHeight: 52, textAlignVertical: 'center' as const };

/** How the person chose to get in (for the funnel analytics). */
export type SignInMethod = 'password' | 'email_code' | 'google' | 'apple';

interface Props {
  initialMode?: Mode;
  /** Called when a sign-in method is used (a button for it was pressed), before the request is made. */
  onMethod?: (method: SignInMethod) => void;
  /** The "Sign in to Fuelift" heading. Off inside the account modal, which has its own title. */
  showHeading?: boolean;
}

/**
 * Everything on the sign-in screen: Create account / Log in, the sign-in code, forgot password and the "check your
 * inbox" state. Shared by the sign-in screen and the account modal on "Building your plan…".
 */
export function SignInForm({ initialMode = 'signUp', onMethod, showHeading = true }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
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
    onMethod?.('password');
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
    onMethod?.('email_code');
    const r = await run(() => sendEmailCode(supabase, email));
    if (r?.ok) setCodeSent(true);
  };
  const verifyCode = () => run(() => verifyEmailCode(supabase, email, code));

  const sendReset = async () => {
    const r = await run(() => sendPasswordReset(supabase, email, authRedirect('reset-password')));
    if (r?.ok) setNotice(authCopy.resetSent);
  };

  const browserOAuth = (provider: OAuthProvider) => run(() => signInWithOAuth(supabase, provider, authRedirect('auth'), isWeb ? undefined : openAuthSession));

  // Google: the phone's account picker when it is set up, otherwise the browser flow (web and fallback).
  const onGoogle = () => {
    onMethod?.('google');
    if (isWeb || !googleNativeConfigured) return browserOAuth('google');
    return run(async () => {
      const r = await nativeGoogle();
      if (r.status === 'cancelled') return { ok: true as const }; // backed out: no error
      return r.status === 'ok' ? signInWithGoogleToken(supabase, r.idToken) : { ok: false as const, error: authCopy.genericError };
    });
  };
  // Apple: the system sheet on iOS (hashed nonce to Apple, raw nonce to Supabase); the browser flow elsewhere.
  const onApple = () => {
    onMethod?.('apple');
    if (Platform.OS !== 'ios') return browserOAuth('apple');
    return run(async () => {
      const r = await nativeApple();
      if (r.status === 'cancelled') return { ok: true as const };
      if (r.status === 'error') return { ok: false as const, error: authCopy.genericError };
      const result = await signInWithAppleToken(supabase, r.identityToken, r.rawNonce);
      if (result.ok) {
        // Apple sends the name only now, on the first sign-in: keep it.
        const { data } = await supabase.auth.getUser();
        if (data.user) await saveAppleName(supabase, data.user.id, r.fullName);
      }
      return result;
    });
  };
  const providers = visibleProviders(oauthEnabled, Platform.OS);

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
      <View style={{ gap: 20 }}>
        <Text variant="display" accessibilityRole="header">{authCopy.confirmTitle}</Text>
        <Text tone="muted">{authCopy.confirmBody(email.trim())}</Text>
        <Button label={wait > 0 ? authCopy.resendIn(wait) : authCopy.resend} variant="secondary" loading={busy} disabled={wait > 0} onPress={() => void resend()} />
        {notice ? <Text tone="accent" accessibilityLiveRegion="polite">{notice}</Text> : null}
        {errorBlock}
        <Button label={authCopy.backToLogIn} variant="ghost" onPress={() => { setMode('logIn'); go('form'); }} />
      </View>
    );
  }

  if (step === 'reset') {
    return (
      <View style={{ gap: 20 }}>
        <Text variant="display" accessibilityRole="header">{authCopy.resetTitle}</Text>
        <Text tone="muted">{authCopy.resetBody}</Text>
        {emailField}
        <Button label={authCopy.resetSend} loading={busy} onPress={() => void sendReset()} />
        {notice ? <Text tone="accent" accessibilityLiveRegion="polite">{notice}</Text> : null}
        {errorBlock}
        <Button label={authCopy.backToLogIn} variant="ghost" onPress={() => go('form')} />
      </View>
    );
  }

  if (step === 'code') {
    return (
      <View style={{ gap: 20 }}>
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
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      {showHeading ? (
        <View style={{ gap: 8 }}>
          <Text variant="display" accessibilityRole="header">{authCopy.title}</Text>
          <Text tone="muted">{authCopy.subtitle}</Text>
        </View>
      ) : null}

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

      {providers.google || providers.apple ? (
        <View style={{ gap: 8 }}>
          {providers.google ? <ProviderButton provider="google" label={authCopy.google} disabled={busy} onPress={() => void onGoogle()} /> : null}
          {providers.apple ? <ProviderButton provider="apple" label={authCopy.apple} disabled={busy} onPress={() => void onApple()} /> : null}
        </View>
      ) : null}
    </View>
  );
}
