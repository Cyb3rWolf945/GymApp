import * as AppleAuthentication from 'expo-apple-authentication';
import { nativeNonceDeps } from './nativeCrypto';
import { makeNonce } from './nonce';
import type { AppleFullName } from './authService';

// The phone's own account sheets. Both return what Supabase needs, or say the person backed out.

export type NativeResult<T> = ({ status: 'ok' } & T) | { status: 'cancelled' } | { status: 'error' };

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

/** The native Google picker needs the web client ID (it is the token's audience). Without it we use the browser flow. */
export const googleNativeConfigured = webClientId !== '';

export async function nativeGoogle(): Promise<NativeResult<{ idToken: string }>> {
  try {
    // Loaded here, not at the top: the native module does not exist on web.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId, iosClientId: iosClientId || undefined });
    await GoogleSignin.hasPlayServices();
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return { status: 'cancelled' };
    return res.data.idToken ? { status: 'ok', idToken: res.data.idToken } : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

export async function nativeApple(): Promise<NativeResult<{ identityToken: string; rawNonce: string; fullName: AppleFullName | null }>> {
  try {
    const nonce = await makeNonce(nativeNonceDeps);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: nonce.hashed,
    });
    if (!cred.identityToken) return { status: 'error' };
    return { status: 'ok', identityToken: cred.identityToken, rawNonce: nonce.raw, fullName: cred.fullName ?? null };
  } catch (e) {
    return (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED' ? { status: 'cancelled' } : { status: 'error' };
  }
}
