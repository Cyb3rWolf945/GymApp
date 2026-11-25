import { Platform } from 'react-native';
import { supabase } from '../supabase';

/** Push needs a real device build; the web app has no Expo push token. */
export const pushSupported = Platform.OS !== 'web';

export type EnableResult = 'enabled' | 'denied' | 'unsupported' | 'error';

const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/**
 * Ask the OS for permission, get the Expo push token and store it for this user (own row, RLS).
 * The reminder is sent by the `send-reminders` Edge Function in this device's local reminder hour.
 */
export async function enablePush(userId: string): Promise<EnableResult> {
  if (!pushSupported) return 'unsupported';
  try {
    // Loaded only on devices: these modules are not needed (or useful) on the web.
    const [Notifications, Device, Constants] = await Promise.all([import('expo-notifications'), import('expo-device'), import('expo-constants')]);
    if (!Device.isDevice) return 'unsupported'; // simulators have no push token

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', { name: 'Workout reminders', importance: Notifications.AndroidImportance.DEFAULT });
    }
    const cfg = Constants.default;
    const projectId = (cfg.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? cfg.easConfig?.projectId;
    if (!projectId) return 'error'; // EAS project not linked yet
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase
      .from('push_tokens')
      .upsert({ user_id: userId, token, platform: Platform.OS === 'ios' ? 'ios' : 'android', tz: deviceTimeZone(), enabled: true } as never, { onConflict: 'token' });
    return error ? 'error' : 'enabled';
  } catch {
    return 'error';
  }
}

/** Switch reminders off for every device of this user. */
export async function disablePush(userId: string): Promise<boolean> {
  const { error } = await supabase.from('push_tokens').update({ enabled: false } as never).eq('user_id', userId);
  return !error;
}

/** Is at least one device of this user set to get reminders? */
export async function fetchPushEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('push_tokens').select('id').eq('user_id', userId).eq('enabled', true).limit(1);
  return !error && (data?.length ?? 0) > 0;
}
