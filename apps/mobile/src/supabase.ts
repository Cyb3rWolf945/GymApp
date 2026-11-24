import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && anonKey);

const isWeb = Platform.OS === 'web';
const isServer = isWeb && typeof window === 'undefined';

// Placeholder values keep the app booting (sign-in shows a config error) when keys are missing.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: {
    // Web: default localStorage. Native: AsyncStorage. Static render (no window): in-memory.
    storage: isServer ? undefined : isWeb ? undefined : AsyncStorage,
    persistSession: !isServer,
    autoRefreshToken: !isServer,
    detectSessionInUrl: isWeb && !isServer,
    flowType: 'pkce',
  },
});
