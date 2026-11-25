import { describe, expect, it } from 'vitest';
import { showOfflineBanner } from './online';

describe('offline banner', () => {
  it('shows only when the device is known to be offline', () => {
    expect(showOfflineBanner(false)).toBe(true);
    expect(showOfflineBanner(true)).toBe(false);
    expect(showOfflineBanner(null)).toBe(false);
  });
});
