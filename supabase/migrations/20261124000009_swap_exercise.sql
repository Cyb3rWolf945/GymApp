-- E-14: "Swap exercise". Deterministic alternatives from the library (no LLM) and a record of each swap.

-- A swap replaces one exercise of one day of the user's current plan (the generation job).
-- Swaps are the signal for memory ("always swaps lunges"). Own rows only.
create table public.plan_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  day_index int not null check (day_index >= 0),
  from_slug text not null,
  to_slug text not null,
  created_at timestamptz not null default now(),
  check (from_slug <> to_slug)
);
create index on public.plan_swaps(user_id, created_at desc);
create index on public.plan_swaps(job_id);
alter table public.plan_swaps enable row level security;
create policy plan_swaps_own on public.plan_swaps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Alternatives for one exercise: shares a primary muscle, equipment the user has (bodyweight always),
-- no contraindication for the declared injuries, not above the user's level, not already in the day.
-- Closest first: same mechanic, then most shared primary muscles, then name.
create function public.swap_candidates(
  p_slug text, p_equipment text[], p_contraindications text[], p_level text, p_exclude text[] default '{}'
)
returns table (slug text, name text, equipment text, level text, mechanic text)
language sql stable security invoker set search_path = public as $$
  with src as (
    select e.id, e.mechanic from public.exercises e where e.slug = p_slug
  ), src_muscles as (
    select m.muscle from public.exercise_muscles m join src on src.id = m.exercise_id where m.role = 'primary'
  )
  select e.slug, e.name, e.equipment, e.level, e.mechanic
  from public.exercises e
  join public.exercise_muscles m on m.exercise_id = e.id and m.role = 'primary'
  where m.muscle in (select muscle from src_muscles)
    and e.slug <> p_slug
    and not (e.slug = any (p_exclude))
    and (e.equipment = any (p_equipment) or e.equipment = 'bodyweight')
    and not (e.contraindications && p_contraindications)
    and array_position(array['beginner','intermediate','advanced'], e.level)
        <= array_position(array['beginner','intermediate','advanced'], p_level)
  group by e.id
  order by (e.mechanic is not distinct from (select mechanic from src)) desc, count(*) desc, e.name
  limit 8;
$$;
