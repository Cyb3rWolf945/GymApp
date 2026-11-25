import { useLocalSearchParams } from 'expo-router';
import { SignInForm } from '../../src/auth/SignInForm';
import { Screen } from '../../src/ui';

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  return (
    <Screen center framed keyboardTaps>
      <SignInForm initialMode={params.mode === 'login' ? 'logIn' : 'signUp'} />
    </Screen>
  );
}
