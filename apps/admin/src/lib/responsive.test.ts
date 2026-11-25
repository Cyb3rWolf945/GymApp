import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The admin must work on a phone. These checks keep the responsive rules from quietly regressing: they read the
// source, so they cost nothing and need no browser. (The access guards live in guards.test.ts and are unaffected.)

const SRC = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(SRC, ...p), 'utf8');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? files(f) : /\.tsx$/.test(n) ? [f] : [];
  });

describe('responsive admin', () => {
  it('stat-card grids start with one column on phones', () => {
    for (const f of files(join(SRC, 'app'))) {
      for (const [cls] of readFileSync(f, 'utf8').matchAll(/className="[^"]*\bgrid\b[^"]*"/g)) {
        // A grid that has columns at all must name its phone layout: grid-cols-1, or no columns until `sm:`/`lg:`.
        expect(cls, `${f}: ${cls}`).not.toMatch(/(^|[ "])grid-cols-[2-9]/);
      }
    }
  });

  it('the sidebar is fixed from lg and sits behind a menu button (Sheet) below it', () => {
    const layout = read('app', '(admin)', 'layout.tsx');
    expect(layout).toMatch(/<aside className="hidden[^"]*lg:block/);
    expect(layout).toContain('<MobileNav>');
    const nav = read('components', 'mobile-nav.tsx');
    expect(nav).toMatch(/lg:hidden/);
    expect(nav).toContain('Sheet');
  });

  it('tables scroll inside their card and keep the first column in view', () => {
    const page = read('components', 'page.tsx');
    expect(page).toContain('overflow-x-auto');
    expect(page).toMatch(/sticky left-0/);
  });

  it('charts resize with the window', () => {
    expect(read('components', 'chart.tsx')).toContain('ResponsiveContainer');
  });
});
