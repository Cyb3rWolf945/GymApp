-- E-34: Admin Engagement and Content. Aggregates only (no user ids leave these functions), service role only.

-- Active user = any workout started or any identified analytics event that day (UTC). DAU, WAU (trailing 7 days) and workouts finished.
create function public.engagement_daily(p_days int default 30)
returns table (day date, dau int, wau int, workouts int)
language sql stable security invoker set search_path = public as $$
  with activity as (
    select distinct d, user_id from (
      select (s.started_at at time zone 'UTC')::date as d, s.user_id
        from public.workout_sessions s where s.started_at >= current_date - (p_days + 6)
      union all
      select (e.created_at at time zone 'UTC')::date, e.user_id
        from public.analytics_events e where e.user_id is not null and e.created_at >= current_date - (p_days + 6)
    ) a
  ), days as (
    select g::date as day from generate_series(current_date - (p_days - 1), current_date, interval '1 day') g
  )
  select days.day,
         (select count(*) from activity a where a.d = days.day)::int,
         (select count(distinct a.user_id) from activity a where a.d between days.day - 6 and days.day)::int,
         (select count(*) from public.workout_sessions s
           where s.finished_at is not null and (s.started_at at time zone 'UTC')::date = days.day)::int
  from days order by days.day;
$$;

-- Average adherence: finished workouts in the window vs. the days per week the user asked for, capped at 100%.
-- Only users who have been around for at least a week, and for new-ish users only the days they have had.
create function public.engagement_adherence(p_days int default 28)
returns table (users int, avg_pct numeric)
language sql stable security invoker set search_path = public as $$
  with per_user as (
    select least(1.0,
             (select count(*) from public.workout_sessions s
               where s.user_id = p.user_id and s.finished_at is not null
                 and s.started_at >= now() - make_interval(days => p_days))::numeric
             / nullif((p.onboarding ->> 'daysPerWeek')::numeric
                      * least(p_days, extract(day from now() - p.created_at)) / 7.0, 0)) as pct
    from public.profiles p
    where (p.onboarding ->> 'daysPerWeek') ~ '^[0-9]+$'
      and p.created_at <= now() - interval '7 days'
  )
  select count(pct)::int, round(avg(pct) * 100, 1) from per_user where pct is not null;
$$;

-- Retention by signup day: of the people who signed up that day, how many were active exactly 1, 7 and 30 days later.
-- A column stays null until that day has been reached.
create function public.retention_cohorts(p_days int default 60)
returns table (cohort date, size int, d1 int, d7 int, d30 int)
language sql stable security invoker set search_path = public as $$
  with cohorts as (
    select p.user_id, (p.created_at at time zone 'UTC')::date as c
    from public.profiles p where p.created_at >= current_date - p_days
  ), activity as (
    select distinct d, user_id from (
      select (s.started_at at time zone 'UTC')::date as d, s.user_id from public.workout_sessions s where s.started_at >= current_date - p_days
      union all
      select (e.created_at at time zone 'UTC')::date, e.user_id from public.analytics_events e where e.user_id is not null and e.created_at >= current_date - p_days
    ) a
  )
  select co.c, count(*)::int,
    case when co.c + 1  <= current_date then count(*) filter (where exists (select 1 from activity a where a.user_id = co.user_id and a.d = co.c + 1))::int end,
    case when co.c + 7  <= current_date then count(*) filter (where exists (select 1 from activity a where a.user_id = co.user_id and a.d = co.c + 7))::int end,
    case when co.c + 30 <= current_date then count(*) filter (where exists (select 1 from activity a where a.user_id = co.user_id and a.d = co.c + 30))::int end
  from cohorts co group by co.c order by co.c desc;
$$;

-- Most swapped-out exercises and meals across all users (names only).
create function public.top_swaps(p_limit int default 10)
returns table (kind text, name text, swaps int)
language sql stable security invoker set search_path = public as $$
  (select 'exercise'::text, e.name, count(*)::int from public.plan_swaps s join public.exercises e on e.slug = s.from_slug
    group by e.name order by count(*) desc, e.name limit p_limit)
  union all
  (select 'meal'::text, r.name, count(*)::int from public.meal_swaps s join public.recipes r on r.slug = s.from_slug
    group by r.name order by count(*) desc, r.name limit p_limit);
$$;

-- Prompt versions: at most one active version per prompt name, switched in one statement.
create unique index prompt_versions_one_active on public.prompt_versions(name) where active;
create function public.activate_prompt_version(p_id uuid) returns boolean
language plpgsql security invoker set search_path = public as $$
declare v_name text;
begin
  select name into v_name from public.prompt_versions where id = p_id;
  if v_name is null then return false; end if;
  update public.prompt_versions set active = false where name = v_name and active and id <> p_id;
  update public.prompt_versions set active = true where id = p_id;
  return true;
end $$;

-- Results of red-team and eval runs (written by scripts/record-eval.ts with the service role, read by the admin).
create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  suite text not null check (suite in ('red_team', 'plan_quality')),
  profile text not null check (profile in ('dev', 'prod', 'offline')),
  total int not null check (total >= 0),
  passed int not null check (passed >= 0 and passed <= total),
  -- Ids of the failing cases, never raw user data.
  failures jsonb not null default '[]',
  note text,
  created_at timestamptz not null default now()
);
create index on public.eval_runs(suite, created_at desc);
alter table public.eval_runs enable row level security; -- no policies: service role only

revoke all on function public.engagement_daily(int), public.engagement_adherence(int), public.retention_cohorts(int),
  public.top_swaps(int), public.activate_prompt_version(uuid) from public, anon, authenticated;
grant execute on function public.engagement_daily(int), public.engagement_adherence(int), public.retention_cohorts(int),
  public.top_swaps(int), public.activate_prompt_version(uuid) to service_role;
