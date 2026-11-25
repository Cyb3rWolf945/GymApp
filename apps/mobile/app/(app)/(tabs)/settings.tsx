import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { BAR_RANGE, COACH_STYLES, LEGAL_KINDS, PLATE_CHOICES, type CoachStyle } from '@gymapp/shared';
import { deleteAccount, deliverExport, fetchExport } from '../../../src/account/api';
import { signOut } from '../../../src/auth/authService';
import { useAuth } from '../../../src/auth/AuthProvider';
import { authCopy } from '../../../src/auth/copy';
import { SignInMethods } from '../../../src/auth/SignInMethods';
import { en } from '../../../src/copy/en';
import { useCoachStyle } from '../../../src/coach/useCoachStyle';
import { usePlateConfig } from '../../../src/workout/plateSettings';
import { useWeeklyAdaptSetting } from '../../../src/plan/weekly';
import { usePushReminders } from '../../../src/push/usePushReminders';
import { supabase } from '../../../src/supabase';
import { THEME_PREFERENCES, type ThemePreference, useTheme, useThemePreference } from '../../../src/theme';
import { BottomSheet, Button, Card, ChipGroup, ListItem, Screen, Text, TextField, useToast } from '../../../src/ui';

const t = en.home;
const d = t.data;

export default function SettingsScreen() {
  const { user } = useAuth();
  const { spacing } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const push = usePushReminders();
  const weekly = useWeeklyAdaptSetting();
  const coach = useCoachStyle();
  const appearance = useThemePreference();
  const plates = usePlateConfig();
  const [barText, setBarText] = useState<string | null>(null);
  const [pickedPlates, setPickedPlates] = useState<string[] | null>(null);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [coachError, setCoachError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportMyData = async () => {
    setExporting(true);
    setError(null);
    const json = await fetchExport();
    if (!json) {
      setExporting(false);
      return setError(d.exportError);
    }
    await deliverExport(json);
    setExporting(false);
    toast.show(d.exportDone, 'success');
  };

  const deleteMyAccount = async () => {
    setDeleting(true);
    setError(null);
    const ok = await deleteAccount();
    if (!ok) {
      setDeleting(false);
      return setError(d.deleteError);
    }
    setConfirming(false);
    // The auth user is gone: end the local session (the root layout then shows onboarding).
    await signOut(supabase);
  };

  return (
    <Screen variant="reading">
        <Text variant="display">{t.settingsTitle}</Text>
        <Card style={{ gap: spacing.sm }}>
          <Text variant="small" tone="muted">{t.account}</Text>
          <Text variant="bodyStrong">{user?.email ?? ''}</Text>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text variant="heading">{en.appearance.title}</Text>
          <Text tone="muted">{en.appearance.body}</Text>
          <ChipGroup
            options={THEME_PREFERENCES.map((v) => ({ value: v, label: en.appearance.options[v] }))}
            value={[appearance.preference]}
            onChange={(v) => v[0] && appearance.setPreference(v[0] as ThemePreference)}
          />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text variant="heading">{en.coach.settingsTitle}</Text>
          <Text tone="muted">{en.coach.settingsBody}</Text>
          <ChipGroup
            options={COACH_STYLES.map((v) => ({ value: v, label: en.coach.styles[v].label }))}
            value={[coach.style]}
            onChange={(v) => {
              const next = v[0] as CoachStyle | undefined;
              if (!next) return;
              setCoachError(false);
              void coach.save(next).then((ok) => (ok ? toast.show(en.coach.saved, 'success') : setCoachError(true)));
            }}
          />
          <Text variant="small" tone="muted">{en.coach.styles[coach.style].example}</Text>
          {coachError ? <Text tone="danger" accessibilityRole="alert">{en.coach.error}</Text> : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text variant="heading">{en.plateSettings.title}</Text>
          <Text tone="muted">{en.plateSettings.body}</Text>
          <Text variant="bodyStrong">{en.plateSettings.bar(plates.config.unit)}</Text>
          <TextField
            value={barText ?? String(plates.config.bar)}
            onChangeText={setBarText}
            keyboardType="decimal-pad"
            accessibilityLabel={en.plateSettings.bar(plates.config.unit)}
          />
          <Text variant="bodyStrong">{en.plateSettings.plates(plates.config.unit)}</Text>
          <ChipGroup
            multiple
            options={PLATE_CHOICES[plates.config.unit].map((p) => ({ value: String(p), label: String(p) }))}
            value={pickedPlates ?? plates.config.plates.map(String)}
            onChange={setPickedPlates}
          />
          {plateError ? <Text tone="danger" accessibilityRole="alert">{plateError}</Text> : null}
          <Button
            label={en.common.save}
            variant="secondary"
            onPress={() => {
              const unit = plates.config.unit;
              const bar = Number((barText ?? String(plates.config.bar)).replace(',', '.'));
              const picked = (pickedPlates ?? plates.config.plates.map(String)).map(Number);
              const r = BAR_RANGE[unit];
              if (!(bar >= r.min && bar <= r.max)) return setPlateError(en.plateSettings.barError(r.min, r.max, unit));
              if (picked.length === 0) return setPlateError(en.plateSettings.platesError);
              setPlateError(null);
              void plates.save({ unit, bar, plates: picked.sort((a, b) => b - a) }).then(() => {
                setBarText(null);
                setPickedPlates(null);
                toast.show(en.plateSettings.saved, 'success');
              });
            }}
          />
        </Card>

        {weekly.enabled !== null ? (
          <Card style={{ gap: spacing.sm }}>
            <Text variant="heading">{t.weekly.settingsTitle}</Text>
            <Text tone="muted">{t.weekly.settingsBody}</Text>
            {weekly.enabled ? <Text variant="small" tone="accent">{t.weekly.enabledNote}</Text> : null}
            <Button label={weekly.enabled ? t.weekly.off : t.weekly.on} variant="secondary" loading={weekly.busy} onPress={() => void weekly.toggle()} />
            {weekly.error ? <Text tone="danger" accessibilityRole="alert">{t.weekly.error}</Text> : null}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          <Text variant="heading">{t.reminders.title}</Text>
          <Text tone="muted">{push.supported ? t.reminders.body : t.reminders.webNote}</Text>
          {push.supported ? (
            <>
              {push.enabled ? <Text variant="small" tone="accent">{t.reminders.enabledNote}</Text> : null}
              <Button label={push.enabled ? t.reminders.off : t.reminders.on} variant="secondary" loading={push.busy} onPress={() => void push.toggle()} />
              {push.error ? <Text tone="danger" accessibilityRole="alert">{push.error === 'denied' ? t.reminders.denied : t.reminders.error}</Text> : null}
            </>
          ) : null}
        </Card>

        <SignInMethods />

        <Card style={{ gap: spacing.xs }}>
          <ListItem title={t.profile.link} onPress={() => router.push('/profile')} />
          <ListItem title={t.memory.link} onPress={() => router.push('/memory')} />
        </Card>

        <Card style={{ gap: spacing.xs }}>
          <Text variant="heading">{t.legal.title}</Text>
          {LEGAL_KINDS.map((k) => (
            <ListItem key={k} title={t.legal[k]} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: k } })} />
          ))}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text variant="heading">{d.title}</Text>
          <Text tone="muted">{d.exportBody}</Text>
          <Button label={d.export} variant="secondary" loading={exporting} onPress={() => void exportMyData()} />
          {error && !confirming ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
          <View style={{ height: spacing.sm }} />
          <Button label={d.delete} variant="danger" onPress={() => { setError(null); setConfirming(true); }} />
        </Card>

        <Text variant="small" tone="muted">{en.health.disclaimer}</Text>
        <Button label={authCopy.signOut} variant="secondary" onPress={() => void signOut(supabase)} />
      <BottomSheet visible={confirming} onClose={() => !deleting && setConfirming(false)} title={d.deleteTitle} closeLabel={en.common.close}>
        <Text tone="muted">{d.deleteBody}</Text>
        {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
        <Button label={d.deleteConfirm} variant="danger" loading={deleting} onPress={() => void deleteMyAccount()} />
        <Button label={d.deleteCancel} variant="secondary" disabled={deleting} onPress={() => setConfirming(false)} />
      </BottomSheet>
    </Screen>
  );
}
