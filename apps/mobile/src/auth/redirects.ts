import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Where the links in our emails (and OAuth) send you back to. Web: this site's `/auth` page. Native: the `fuelift://`
 * deep link. Both must be on the Supabase redirect allow-list (owner step, see E-44).
 */
export function authRedirect(path: 'auth' | 'reset-password'): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/${path}`;
  return Linking.createURL(path);
}

/** Google and Apple stay hidden until the owner has switched the provider on in Supabase and set the flag. */
export const oauthEnabled = {
  google: process.env.EXPO_PUBLIC_AUTH_GOOGLE === '1',
  apple: process.env.EXPO_PUBLIC_AUTH_APPLE === '1',
};
