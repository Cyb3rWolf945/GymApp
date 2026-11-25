import { describe, expect, it } from 'vitest';
import { applyFiles, orderFiles, wrapFile } from './apply-remote';

describe('apply-remote', () => {
  const files = orderFiles(
    [
      { name: '2.sql', sql: 'select 2;' },
      { name: '1.sql', sql: 'select 1;' },
    ],
    [{ name: 's.sql', sql: "select 'x';" }],
  );

  it('orders migrations before seed, sorted by name', () => {
    expect(files.map((f) => f.name)).toEqual(['migrations/1.sql', 'migrations/2.sql', 'seed/s.sql']);
  });

  it('wraps a file with its tracking row in one transaction', () => {
    const sql = wrapFile({ name: "a'b.sql", sql: 'select 1;' });
    expect(sql).toMatch(/^begin;/);
    expect(sql).toContain("values ('a''b.sql')");
    expect(sql).toMatch(/commit;$/);
  });

  it('is idempotent: skips files already recorded', async () => {
    const recorded = new Set<string>();
    const query = async (sql: string) => {
      if (sql.startsWith('select name')) return [...recorded].map((name) => ({ name }));
      const m = /values \('(.+?)'\);\ncommit/.exec(sql);
      if (m) recorded.add(m[1]);
      return [];
    };
    const first = await applyFiles(query, files);
    expect(first.applied).toHaveLength(3);
    const second = await applyFiles(query, files);
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);
  });
});
