import { StyleSheet, Text, View } from 'react-native';
import { APP_NAME } from '@gymapp/shared';
import { colors } from '../src/theme';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.subtitle}>Your plan is on its way.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: { color: colors.accent, fontSize: 32, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: 8 },
});
