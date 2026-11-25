-- E-54: automatic weekly plan adaptation (Elite "weekly_adjust").
-- A weekly job (pg_cron -> Edge Function `weekly-adapt`) rebuilds the plans through the normal update pipeline.
-- The new plan is active right away and marked `adapt_state = 'new'`; the user then keeps it or goes back to last week's.

alter table public.generation_jobs
  add column source text not null default 'user' check (source in ('user', 'weekly')),
  add column adapt_week date,                                                   -- Monday (UTC) of the run; null for user-started jobs
  add column adapt_state text check (adapt_state in ('new', 'kept', 'reverted'));
-- Idempotent per user, kind and week: a second run in the same week finds the first one (failed jobs may be retried).
create unique index generation_jobs_weekly_once on public.generation_jobs (user_id, kind, adapt_week)
  where adapt_week is not null and status <> 'failed';

-- Users can switch it off (profiles are already own-row writable). On by default.
alter table public.profiles add column weekly_adapt boolean not null default true;

-- "Keep new plan" / "Go back to last week": own jobs of that week only. `reverted` jobs are skipped when the app picks the current plan.
create function public.resolve_weekly_adapt(p_week date, p_keep boolean)
returns int language sql volatile security definer set search_path = public as $$
  with u as (
    update public.generation_jobs
       set adapt_state = case when p_keep then 'kept' else 'reverted' end
     where user_id = auth.uid() and adapt_week = p_week and adapt_state = 'new'
    returning 1
  ) select count(*)::int from u;
$$;
revoke all on function public.resolve_weekly_adapt(date, boolean) from public, anon;
grant execute on function public.resolve_weekly_adapt(date, boolean) to authenticated, service_role;

-- Scheduling. pg_cron and pg_net exist on Supabase projects (not in the local test database: then this block does nothing).
-- The function URL and service key come from Vault secrets `functions_url` and `service_role_key` (set by the owner, never in git).
create function public.run_weekly_adapt() returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise notice 'weekly-adapt: Vault secrets functions_url / service_role_key are not set';
    return;
  end if;
  perform net.http_post(url := v_url || '/weekly-adapt', headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'), body := '{}'::jsonb);
end $$;
revoke all on function public.run_weekly_adapt() from public, anon, authenticated;

do $$
declare v_job bigint;
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    -- Mondays 06:00 UTC. Active only when the database setting app.environment is 'production'; everywhere else it is created disabled.
    v_job := cron.schedule('weekly-adapt', '0 6 * * 1', 'select public.run_weekly_adapt()');
    if coalesce(current_setting('app.environment', true), '') <> 'production' then
      perform cron.alter_job(v_job, active := false);
    end if;
  end if;
end $$;
