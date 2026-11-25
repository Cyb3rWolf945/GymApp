import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { type Attribution, mergeAttribution, parseAttribution } from '@gymapp/shared';

// Web-only marketing state: the cookie banner choice, first-touch attribution and the Meta Pixel.
// Nothing here runs on iOS or Android, and the Pixel loads only after the visitor accepts.

export type TrackingChoice = 'accepted' | 'rejected';
const CHOICE_KEY = 'fuelift.tracking_choice';
const ATTRIBUTION_KEY = 'fuelift.attribution';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
// The query string as the visitor arrived. Read once at load: the router redirects signed-out visitors from `/` to
// the landing route and drops the query, so reading it later would lose the UTM tags.
const arrivalSearch = isWeb ? window.location.search : '';
const listeners = new Set<(c: TrackingChoice | null) => void>();

export async function getTrackingChoice(): Promise<TrackingChoice | null> {
  const v = await AsyncStorage.getItem(CHOICE_KEY).catch(() => null);
  return v === 'accepted' || v === 'rejected' ? v : null;
}

export async function setTrackingChoice(choice: TrackingChoice): Promise<void> {
  await AsyncStorage.setItem(CHOICE_KEY, choice).catch(() => {});
  listeners.forEach((l) => l(choice));
  if (choice === 'accepted') initPixel();
}
export const onTrackingChoice = (l: (c: TrackingChoice | null) => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

// ---- Attribution (UTM tags, Facebook click id), first touch wins.

export async function getAttribution(): Promise<Attribution> {
  try {
    return JSON.parse((await AsyncStorage.getItem(ATTRIBUTION_KEY)) ?? '{}') as Attribution;
  } catch {
    return {};
  }
}

/** Read the landing URL's tags and keep the first ones. Returns what is stored now. */
export async function captureAttribution(): Promise<Attribution> {
  const stored = await getAttribution();
  if (!isWeb) return stored;
  const merged = mergeAttribution(stored, parseAttribution(arrivalSearch));
  await AsyncStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(merged)).catch(() => {});
  return merged;
}

// ---- Meta Pixel (browser). Server side events go through the Edge Functions.

const PIXEL_ID = process.env.EXPO_PUBLIC_META_PIXEL_ID;
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
let pixelStarted = false;

/** Load the Pixel script. Call only after the visitor accepted tracking. No-op without a configured Pixel id. */
export function initPixel(): void {
  if (!isWeb || !PIXEL_ID || pixelStarted) return;
  pixelStarted = true;
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else (fbq.queue as unknown[]).push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = fbq;
  w.fbq = fbq;
  w._fbq = fbq;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');
}

/** A standard Meta event with a dedup id (`eventID`), only if the visitor accepted. */
export async function pixelTrack(name: 'Lead' | 'StartTrial' | 'Purchase', eventId: string, params: Record<string, unknown> = {}): Promise<void> {
  if (!isWeb || !PIXEL_ID || (await getTrackingChoice()) !== 'accepted') return;
  initPixel();
  (window as unknown as { fbq?: Fbq }).fbq?.('track', name, params, { eventID: eventId });
}

/** Meta's `_fbp` browser id (exists once the Pixel has run) and the stored click id, for server side matching. */
export async function marketingIds(): Promise<{ fbp?: string; fbc?: string } | null> {
  if (!isWeb || (await getTrackingChoice()) !== 'accepted') return null;
  const fbp = document.cookie.match(/(?:^|; )_fbp=([^;]+)/)?.[1];
  const { fbc } = await getAttribution();
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
}
