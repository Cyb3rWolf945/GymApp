import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { type PartialAnswers, type StepId, isEditableStep, validateStep } from '@gymapp/shared';
import { useAuth } from '../../../src/auth/AuthProvider';
import { en } from '../../../src/copy/en';
import { STEP_BODIES } from '../../../src/onboarding/steps';
import { fetchProfileAnswers, saveProfileEdit } from '../../../src/profile/api';
import { markPlanOutdated } from '../../../src/profile/outdated';
import { useTheme } from '../../../src/theme';
import { Button, EmptyState, Screen, Text, useToast } from '../../../src/ui';

const t = en.home.profile;
const o = en.onboarding;
type StepCopy = { title: string; body?: string };

/**
 * Edit one answer. It is the onboarding step itself (same component, same `validateStep`), pre-filled with what is
 * saved, with a Save button instead of Continue.
 */
export default function EditProfileStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  if (!isEditableStep(step)) return <Redirect href="/profile" />;
  return <Editor id={step} />;
}

function Editor({ id }: { id: StepId }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const [stored, setStored] = useState<PartialAnswers | null | undefined>(undefined);
  const [draft, setDraft] = useState<PartialAnswers>({});
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!user || loaded.current) return;
    loaded.current = true;
    void fetchProfileAnswers(user.id).then((a) => {
      setStored(a);
      if (a) setDraft(a);
    });
  }, [user]);

  if (stored === undefined) return <Screen center><ActivityIndicator color={colors.accent} /></Screen>;
  if (stored === null) return <Screen center><EmptyState title={t.loadError} actionLabel={t.retry} onAction={() => router.replace(`/profile/${id}`)} /></Screen>;

  const copy = (o.steps as Record<StepId, StepCopy>)[id];
  const Body = STEP_BODIES[id];
  const valid = validateStep(id, draft).ok;
  const update = (patch: PartialAnswers) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (!valid) return setShowError(true);
    if (!user) return;
    setSaving(true);
    setError(false);
    const result = await saveProfileEdit(user.id, stored, draft);
    setSaving(false);
    if (!result.ok) return setError(true);
    if (result.planOutdated) await markPlanOutdated(user.id);
    toast.show(t.saved, 'success');
    router.back();
  };

  return (
    <Screen
      keyboardTaps
      footer={
        <>
          <Button label={saving ? t.saving : t.save} loading={saving} onPress={() => void save()} />
          <Button label={en.common.back} variant="ghost" disabled={saving} onPress={() => router.back()} />
        </>
      }
    >
      <Text variant="display">{copy.title}</Text>
      {copy.body ? <Text tone="muted">{copy.body}</Text> : null}
      <Body answers={draft} update={update} onContinue={() => void save()} />
      {showError && !valid ? <Text tone="danger" accessibilityRole="alert">{id === 'equipment' ? o.errors.pickAtLeastOne : o.errors.pickOne}</Text> : null}
      {error ? <Text tone="danger" accessibilityRole="alert">{t.saveError}</Text> : null}
    </Screen>
  );
}
