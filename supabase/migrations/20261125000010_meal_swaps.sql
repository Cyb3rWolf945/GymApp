-- E-15: "Swap meal". Deterministic alternatives (no LLM); each swap is recorded as a signal for memory.
-- A swap replaces one meal slot of one day of the user's current nutrition plan (the generation job). Own rows only.
create table public.meal_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  day_index int not null check (day_index >= 0),
  meal_index int not null check (meal_index >= 0),
  from_slug text not null,
  to_slug text not null,
  created_at timestamptz not null default now(),
  check (from_slug <> to_slug)
);
create index on public.meal_swaps(user_id, created_at desc);
create index on public.meal_swaps(job_id);
alter table public.meal_swaps enable row level security;
create policy meal_swaps_own on public.meal_swaps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
