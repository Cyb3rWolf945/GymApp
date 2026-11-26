import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { authCopy } from './copy';
import { type OAuthProvider, type SignInMethodId, canUnlink, fetchIdentities, linkProvider, linkedMethods, unlinkProvider } from './authService';
import { openAuthSession } from './browser';
import { visibleProviders } from './logic';
import { authRedirect, oauthEnabled } from './redirects';
import { supabase } from '../supabase';
import { useTheme } from '../theme';
import { Button, Card, InlineSkeleton, Text, useToast } from '../ui';

const t = authCopy.methods;
const isWeb = Platform.OS === 'web';
type Identity = Awaited<ReturnType<typeof fetchIdentities>>[number];

/** Settings → "Sign-in methods": which ways you can log in (email, Google, Apple), link another, unlink one but never the last. */
export function SignInMethods() {
  const { spacing } = useTheme();
  const toast = useToast();
  const [identities, setIdentities] = useState<Identity[] | null | undefined>(undefined); // undefined = loading, null = failed
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchIdentities(supabase).then(setIdentities, () => setIdentities(null));
  }, []);
  useEffect(load, [load]);

  const flags = visibleProviders(oauthEnabled, Platform.OS);
  const linked = linkedMethods(identities ?? []);
  // Offer a provider if its button is on, and always show one that is already linked (so it can be unlinked).
  const shown = (['email', 'google', 'apple'] as const).filter((m) => m === 'email' || linked.includes(m) || flags[m]);

  const link = async (provider: OAuthProvider) => {
    setBusy(provider);
    setError(null);
    const result = await linkProvider(supabase, provider, authRedirect('auth'), isWeb ? undefined : openAuthSession);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    // On the web the browser has left for the provider and comes back through /auth; on the phone we are still here.
    if (!isWeb) {
      toast.show(t.linkedDone(t.names[provider]), 'success');
      load();
    }
  };
  const unlink = async (provider: OAuthProvider) => {
    setBusy(provider);
    setError(null);
    const result = await unlinkProvider(supabase, provider);
    setBusy(null);
    if (!result.ok) return setError(result.error);
    toast.show(t.unlinkedDone(t.names[provider]), 'success');
    load();
  };

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="heading">{t.title}</Text>
      <Text tone="muted">{t.body}</Text>
      {identities === undefined ? <InlineSkeleton lines={3} label={authCopy.loading} /> : null}
      {identities === null ? <Text tone="danger" accessibilityRole="alert">{t.loadError}</Text> : null}
      {identities
        ? shown.map((m: SignInMethodId) => {
            const isLinked = linked.includes(m);
            const name = t.names[m];
            return (
              <View key={m} style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="bodyStrong">{name}</Text>
                  <Text variant="small" tone={isLinked ? 'accent' : 'muted'}>{isLinked ? t.linked : t.notLinked}</Text>
                </View>
                {m !== 'email' ? (
                  isLinked ? (
                    <Button label={t.unlink(name)} variant="secondary" loading={busy === m} disabled={!canUnlink(identities) || busy !== null} onPress={() => void unlink(m)} />
                  ) : (
                    <Button label={t.link(name)} variant="secondary" loading={busy === m} disabled={busy !== null} onPress={() => void link(m)} />
                  )
                ) : null}
              </View>
            );
          })
        : null}
      {identities && !canUnlink(identities) ? <Text variant="small" tone="muted">{t.lastMethod}</Text> : null}
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </Card>
  );
}
