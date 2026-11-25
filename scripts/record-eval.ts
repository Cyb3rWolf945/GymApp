// Run the offline red-team eval and record the result for the admin Content → Evals screen.
//   pnpm eval:redteam            prints the result
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… pnpm eval:redteam   also stores it in `eval_runs`
// The offline suite needs no model and no network. Only case ids are stored, never the strings themselves.
import { createClient } from '@supabase/supabase-js';
import { runRedTeamOffline } from '../packages/shared/src/ai/redteam';

async function main() {
  const r = await runRedTeamOffline();
  console.log(`red team (offline): ${r.passed}/${r.total} passed${r.failures.length ? `, failed: ${r.failures.join(', ')}` : ''}`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set: result not stored.');
  } else {
    const { error } = await createClient(url, key, { auth: { persistSession: false } })
      .from('eval_runs')
      .insert({ suite: 'red_team', profile: 'offline', total: r.total, passed: r.passed, failures: r.failures, note: process.env.EVAL_NOTE ?? null });
    if (error) throw new Error(`Could not store the result: ${error.message}`);
    console.log('stored in eval_runs');
  }
  if (r.failures.length > 0) process.exitCode = 1;
}
void main();
