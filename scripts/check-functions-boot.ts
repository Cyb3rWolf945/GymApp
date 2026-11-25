// Boot check for Supabase Edge Functions: imports every supabase/functions/*/index.ts under Deno,
// with Deno.serve stubbed, so missing exports or bad import paths fail CI instead of failing at deploy
// with BOOT_ERROR. Run: deno run --allow-all scripts/check-functions-boot.ts
const root = new URL('../supabase/functions/', import.meta.url);
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENROUTER_API_KEY']) {
  if (!Deno.env.get(k)) Deno.env.set(k, k === 'SUPABASE_URL' ? 'https://example.supabase.co' : 'boot-check');
}
if (!Deno.env.get('MODEL_PROFILE')) Deno.env.set('MODEL_PROFILE', 'dev');
(Deno as unknown as { serve: unknown }).serve = () => ({});
let failed = 0;
for await (const entry of Deno.readDir(root)) {
  if (!entry.isDirectory) continue;
  const file = new URL(`${entry.name}/index.ts`, root);
  try {
    await Deno.stat(new URL(`${entry.name}/deno.json`, root));
  } catch {
    console.error(`FAIL ${entry.name}: missing deno.json import map`);
    failed++;
    continue;
  }
  try {
    await import(file.href);
    console.log(`OK   ${entry.name}`);
  } catch (e) {
    console.error(`FAIL ${entry.name}: ${(e as Error).message}`);
    failed++;
  }
}
if (failed) Deno.exit(1);
