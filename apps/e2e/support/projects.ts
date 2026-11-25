import { test } from '@playwright/test';

export type ProjectName = 'phone' | 'tablet' | 'desktop';

/** The three screen sizes every spec runs at (see playwright.config.ts). */
export const SIZES: Record<ProjectName, { width: number; height: number }> = {
  phone: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

/**
 * For specs that set their own window sizes (width sweeps, live resizing): running them once is enough, so they skip the
 * `phone` and `tablet` projects instead of repeating the same work three times.
 */
export function ownViewports() {
  // Playwright insists on the destructuring pattern for the first argument, even when no fixture is used.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'sets its own viewports; runs once, in the desktop project');
  });
}
