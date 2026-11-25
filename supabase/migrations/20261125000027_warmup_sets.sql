-- E-56: warm-up sets. A warm-up is logged like any set but flagged, and is never part of PRs, volume or trends.
alter table public.set_logs add column is_warmup boolean not null default false;

-- user_history (planner input): e1RM trends ignore warm-ups.
create or replace function public.user_history(p_user uuid, p_days int default 28)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with win as (select now() - make_interval(days => p_days) as since),
  sess as (
    select count(*)::int as n from public.workout_sessions s, win
    where s.user_id = p_user and s.finished_at is not null and s.started_at >= win.since
  ),
  planned as (
    select coalesce(nullif((p.onboarding ->> 'daysPerWeek'), '')::numeric, 0) as per_week
    from public.profiles p where p.user_id = p_user
  ),
  weights as (
    select b.measured_on, b.weight_kg from public.body_metrics b, win
    where b.user_id = p_user and b.weight_kg is not null and b.measured_on >= (win.since)::date
  ),
  per_session as (
    -- Best e1RM of each exercise in each workout (Epley; one rep is the weight itself).
    select l.exercise_id, l.session_id, min(l.logged_at) as at,
           max(case when l.reps = 1 then l.weight_kg else l.weight_kg * (1 + l.reps / 30.0) end) as e1rm
    from public.set_logs l, win
    where l.user_id = p_user and l.logged_at >= win.since and l.weight_kg > 0 and l.reps > 0
      and not l.is_warmup
    group by l.exercise_id, l.session_id
  ),
  trend as (
    select e.name,
           (array_agg(ps.e1rm order by ps.at asc))[1] as first_e1rm,
           (array_agg(ps.e1rm order by ps.at desc))[1] as last_e1rm,
           count(*) as sessions
    from per_session ps join public.exercises e on e.id = ps.exercise_id
    group by e.name
    having count(*) >= 2
  ),
  swapped as (
    select e.name, count(*)::int as n
    from public.plan_swaps s join public.exercises e on e.slug = s.from_slug, win
    where s.user_id = p_user and s.created_at >= win.since
    group by e.name
  ),
  checks as (
    select c.week_start, c.weight_kg, c.energy, c.sleep, c.workouts_done, c.workouts_planned, c.note
    from public.weekly_checkins c
    where c.user_id = p_user order by c.week_start desc limit 4
  ),
  meals_swapped as (
    select r.name, count(*)::int as n
    from public.meal_swaps s join public.recipes r on r.slug = s.from_slug, win
    where s.user_id = p_user and s.created_at >= win.since
    group by r.name
  )
  select jsonb_build_object(
    'days', p_days,
    'workouts_done', (select n from sess),
    'workouts_planned', (select round(coalesce(max(per_week), 0) * p_days / 7.0)::int from planned),
    'weight_first_kg', (select weight_kg from weights order by measured_on asc limit 1),
    'weight_last_kg', (select weight_kg from weights order by measured_on desc limit 1),
    'e1rm', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'first', round(first_e1rm::numeric, 1), 'last', round(last_e1rm::numeric, 1)) order by abs(last_e1rm - first_e1rm) desc)
                      from (select * from trend order by abs(last_e1rm - first_e1rm) desc limit 8) t), '[]'::jsonb),
    'swapped_exercises', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'times', n) order by n desc, name) from swapped), '[]'::jsonb),
    'swapped_meals', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'times', n) order by n desc, name) from meals_swapped), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(jsonb_build_object('week', week_start, 'weight_kg', weight_kg, 'energy', energy, 'sleep', sleep,
                            'done', workouts_done, 'planned', workouts_planned, 'note', note) order by week_start desc) from checks), '[]'::jsonb),
    'facts', coalesce((select jsonb_agg(fact order by created_at desc)
                       from (select fact, created_at from public.memory_facts where user_id = p_user and not obsolete order by created_at desc limit 15) f), '[]'::jsonb)
  );
$$;

-- Used server-side (service role) by generate-plan; signed-in users only ever see their own rows (RLS).
revoke all on function public.user_history(uuid, int) from public, anon;
grant execute on function public.user_history(uuid, int) to authenticated, service_role;
