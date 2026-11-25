import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { APP_NAME } from '@gymapp/shared';
import { authCopy } from '../../src/auth/copy';
import { signOut } from '../../src/auth/authService';
import { useAuth } from '../../src/auth/AuthProvider';
import { supabase } from '../../src/supabase';
import { fetchJobs } from '../../src/plan/api';
import { colors } from '../../src/theme';

export default function Home() {
  const { user } = useAuth();
  // New accounts have no plan yet: send them to the plan screen (14) first.
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    fetchJobs(user.id).then((jobs) => setHasPlan(jobs.some((j) => j.status !== 'failed')), () => setHasPlan(true));
  }, [user]);
  if (hasPlan === null) return null;
  if (!hasPlan) return <Redirect href="/generating" />;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>{authCopy.signedInTitle}</Text>
      {user?.email ? <Text style={styles.muted}>{user.email}</Text> : null}
      <Pressable style={styles.button} onPress={() => void signOut(supabase)}>
        <Text style={styles.buttonText}>{authCopy.signOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.accent, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.text, fontSize: 16, marginTop: 8 },
  muted: { color: colors.muted, fontSize: 14, marginTop: 4 },
  button: { marginTop: 24, padding: 12, borderRadius: 8, backgroundColor: colors.surface },
  buttonText: { color: colors.text, fontWeight: '600' },
});
