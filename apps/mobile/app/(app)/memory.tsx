import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { en } from '../../src/copy/en';
import { type MemoryFact, deleteMemoryFact, fetchMemoryFacts } from '../../src/plan/api';
import { useTheme } from '../../src/theme';
import { Button, Card, EmptyState, Screen, ScreenSkeleton, Text, useToast } from '../../src/ui';

const t = en.home.memory;

/** Settings → "What the AI knows about me": the notes we keep from feedback, each one deletable. */
export default function Memory() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const [facts, setFacts] = useState<MemoryFact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setFacts(await fetchMemoryFacts(user.id));
      setError(null);
    } catch {
      setError(t.loadError);
      setFacts([]);
    }
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    if (!user) return;
    if (await deleteMemoryFact(user.id, id)) {
      setFacts((cur) => (cur ?? []).filter((f) => f.id !== id));
      toast.show(t.deleted, 'success');
    } else {
      setError(t.deleteError);
    }
  };

  return (
    <Screen style={{ flexGrow: 1 }} footer={<Button label={en.common.back} variant="ghost" onPress={() => router.back()} />}>
        <Text variant="display">{t.title}</Text>
        <Text tone="muted">{t.body}</Text>
        {error && facts && facts.length > 0 ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        {facts === null ? (
          <ScreenSkeleton title={false} cards={1} label={en.common.loading} />
        ) : error && facts.length === 0 ? (
          <EmptyState kind="error" title={error} actionLabel={en.common.retry} onAction={() => { setFacts(null); void load(); }} />
        ) : facts.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState title={t.empty} />
          </View>
        ) : (
          <Card style={{ gap: spacing.xs }}>
            {facts.map((f) => (
              <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{f.fact}</Text>
                </View>
                <Button label={t.delete} variant="ghost" onPress={() => void remove(f.id)} />
              </View>
            ))}
          </Card>
        )}
    </Screen>
  );
}
