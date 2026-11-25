import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A layout is not an authorization boundary in the App Router: layouts and pages render independently and a layout
// does not re-run on client navigation. So every page under (admin) must call requireAdmin() itself, and so must
// every function that reads with the service role. These checks fail the build if someone adds one without it.

const SRC = join(__dirname, '..');
const ADMIN_DIR = join(SRC, 'app', '(admin)');

function pagesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pagesUnder(full);
    return /^(page|route)\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('admin access guards', () => {
  const pages = pagesUnder(ADMIN_DIR);

  it('finds the pages (guards against a broken scan)', () => {
    const names = pages.map((p) => p.slice(ADMIN_DIR.length));
    for (const expected of ['page.tsx', 'pnl', 'funnel', 'ai-health', 'guardrails', 'users', 'ads', 'engagement', 'content']) {
      expect(names.some((n) => n.includes(expected)), expected).toBe(true);
    }
  });

  it('every page and route handler under (admin) calls requireAdmin()', () => {
    for (const page of pages) {
      expect(readFileSync(page, 'utf8'), page).toMatch(/await requireAdmin\(\)/);
    }
  });

  it('every query function in lib/data.ts calls requireAdmin() first', () => {
    const src = readFileSync(join(SRC, 'lib', 'data.ts'), 'utf8');
    const bodies = src.split(/export async function /).slice(1);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) expect(body, body.slice(0, 40)).toMatch(/^\w+\([^)]*\) \{\n\s+await requireAdmin\(\);/);
  });

  it('every server action calls requireAdmin() (actions are public endpoints: a page guard does not cover them)', () => {
    const actionFiles = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return walk(full);
        return /^actions\.ts$/.test(name) ? [full] : [];
      });
    })(ADMIN_DIR);
    expect(actionFiles.length).toBeGreaterThanOrEqual(2); // users and guardrails
    for (const file of actionFiles) {
      const src = readFileSync(file, 'utf8');
      const actions = src.match(/export async function \w+/g) ?? [];
      const guarded = src.match(/await requireAdmin\(\)/g) ?? [];
      expect(actions.length, file).toBeGreaterThan(0);
      expect(guarded.length, `${file}: ${actions.length} actions, ${guarded.length} requireAdmin calls`).toBe(actions.length);
      // And each action audits before it changes anything.
      expect((src.match(/await audit\(/g) ?? []).length, file).toBeGreaterThanOrEqual(actions.length);
    }
  });

  it('the service-role client is only imported by server code', () => {
    const adminClient = readFileSync(join(SRC, 'lib', 'supabase', 'admin.ts'), 'utf8');
    expect(adminClient).toContain("import 'server-only'");
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const full = join(dir, n);
        return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(n) ? [full] : [];
      });
    for (const file of walk(join(SRC, 'components'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/supabase\/admin|SUPABASE_SERVICE_ROLE_KEY/);
    }
  });
});
