-- E-21: GDPR. Consent records and the pieces account deletion needs.

-- One row per consent given: what, which version of the text, when. Append-only for users (no update or delete
-- policy), so the history stays provable. Deleted with the account (cascade).
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'health_data', 'disclaimer', 'notifications')),
  version text not null,
  accepted boolean not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, kind, version)
);
create index on public.consent_records(user_id, accepted_at desc);
alter table public.consent_records enable row level security;
create policy consent_records_select on public.consent_records for select to authenticated using (user_id = auth.uid());
create policy consent_records_insert on public.consent_records for insert to authenticated with check (user_id = auth.uid());

-- Rows that outlive an account because their foreign key is `on delete set null`: delete them too. Guardrail
-- events can hold the user's own text (health data), and behaviour and AI logs are tied to the person.
-- Everything else cascades from auth.users. The delete-account function calls this, then deletes the auth user.
create function public.erase_user_traces(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.guardrail_events where user_id = p_user;
  delete from public.analytics_events where user_id = p_user;
  delete from public.ai_call_logs where user_id = p_user;
$$;
revoke all on function public.erase_user_traces(uuid) from public, anon, authenticated;
grant execute on function public.erase_user_traces(uuid) to service_role;
