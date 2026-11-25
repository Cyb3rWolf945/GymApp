import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

/** Open the provider's page in the system browser on the phone and wait for the redirect back. `null` = closed without finishing. */
export async function openAuthSession(url: string, returnUrl: string): Promise<string | null> {
  const res = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  return res.type === 'success' ? res.url : null;
}
