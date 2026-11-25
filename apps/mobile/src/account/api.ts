import { Platform, Share } from 'react-native';
import { supabase } from '../supabase';

/** The user's data as a JSON string (Edge Function `export-data`), or null on failure. */
export async function fetchExport(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('export-data', { body: {} });
  return error || !data ? null : JSON.stringify(data, null, 2);
}

/** Web: download a file. Native: the system share sheet (save to Files, send to yourself, ...). */
export async function deliverExport(json: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuelift-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ message: json, title: 'Fuelift export' });
}

/** Delete the account and all its data, cancelling the subscription (Edge Function `delete-account`). */
export async function deleteAccount(): Promise<boolean> {
  const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  return !error;
}
