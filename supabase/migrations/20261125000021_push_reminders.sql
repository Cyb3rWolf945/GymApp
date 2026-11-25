-- E-26: Expo push tokens and the hourly workout-day reminder.
-- A token exists only because the user opted in: either the "notifications" consent in onboarding (the app then
-- registers after sign-in) or the Settings toggle. Switching the toggle off disables the token. `consent_records`
-- keeps one row per version, so it records the onboarding choice; the token row (enabled, updated_at) records the rest.

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,80}\]$'),
  platform text not null check (platform in ('ios', 'android')),
  -- IANA time zone of the device, so "17:00" means the user's 17:00.
  tz text not null default 'UTC',
  remind_hour int not null default 17 check (remind_hour between 0 and 23),
  enabled boolean not null default true,
  -- Local date of the last reminder: at most one per day.
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.push_tokens(user_id);
create index on public.push_tokens(enabled, remind_hour) where enabled;
alter table public.push_tokens enable row level security;
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger push_tokens_updated before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- Only real IANA zone names, so the reminder query below can never fail on a bad value.
create function public.push_tokens_check_tz() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from pg_timezone_names z where z.name = new.tz) then
    raise exception 'Unknown time zone: %', new.tz using errcode = '22023';
  end if;
  return new;
end $$;
create trigger push_tokens_tz before insert or update of tz on public.push_tokens
  for each row execute function public.push_tokens_check_tz();

-- Tokens due a reminder right now: enabled, the local hour matches, none sent today (local).
create function public.reminder_candidates(p_now timestamptz default now())
returns table (user_id uuid, token_id uuid, token text, tz text, local_date date, iso_weekday int, display_name text)
language sql stable security invoker set search_path = public as $$
  select t.user_id, t.id, t.token, t.tz,
         (p_now at time zone t.tz)::date,
         extract(isodow from (p_now at time zone t.tz))::int,
         p.display_name
  from public.push_tokens t
  join public.profiles p on p.user_id = t.user_id
  where t.enabled
    and extract(hour from (p_now at time zone t.tz))::int = t.remind_hour
    and t.last_sent_on is distinct from (p_now at time zone t.tz)::date;
$$;
revoke all on function public.reminder_candidates(timestamptz) from public, anon, authenticated;
grant execute on function public.reminder_candidates(timestamptz) to service_role;
