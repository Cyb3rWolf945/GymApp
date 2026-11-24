-- E-02: core schema. All user tables carry user_id -> auth.users(id).

create type public.tier as enum ('none', 'basic', 'pro', 'elite');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- user tables ----------
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  sex text,
  birth_date date,
  height_cm numeric,
  weight_kg numeric,
  goal text,
  experience text,
  units text not null default 'metric',
  locale text not null default 'en',
  onboarding jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier public.tier not null default 'none',
  status text not null default 'none',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  source text not null default 'stripe',
  updated_at timestamptz not null default now()
);
create unique index entitlements_stripe_customer_idx on public.entitlements(stripe_customer_id) where stripe_customer_id is not null;

-- ---------- catalog tables ----------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  equipment text,
  mechanic text,
  instructions text,
  media_url text,
  created_at timestamptz not null default now()
);
create table public.exercise_muscles (
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle text not null,
  role text not null default 'primary' check (role in ('primary','secondary')),
  primary key (exercise_id, muscle)
);
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  instructions text,
  servings int not null default 1,
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  created_at timestamptz not null default now()
);
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kcal_per_100g numeric, protein_per_100g numeric, carbs_per_100g numeric, fat_per_100g numeric
);
create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  grams numeric not null,
  primary key (recipe_id, ingredient_id)
);

-- ---------- workouts ----------
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  version int not null default 1,
  plan jsonb,
  created_at timestamptz not null default now()
);
create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  day_index int not null,
  name text not null
);
create table public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null references public.workout_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  position int not null,
  sets int not null,
  reps_min int, reps_max int,
  rest_seconds int,
  notes text
);
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid references public.workout_days(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  set_index int not null,
  reps int, weight_kg numeric, rpe numeric,
  logged_at timestamptz not null default now()
);

-- ---------- nutrition ----------
create table public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  kcal_target numeric, protein_g numeric, carbs_g numeric, fat_g numeric,
  plan jsonb,
  created_at timestamptz not null default now()
);
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.nutrition_plans(id) on delete cascade,
  day_index int not null,
  slot text not null,
  recipe_id uuid references public.recipes(id),
  kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric
);
create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.nutrition_plans(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  label text not null,
  grams numeric,
  checked boolean not null default false
);
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric, body_fat_pct numeric, waist_cm numeric,
  unique (user_id, measured_on)
);

-- ---------- AI / telemetry ----------
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('workout_plan','nutrition_plan')),
  status text not null default 'queued',
  input jsonb, result jsonb, error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create table public.memory_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  fact text not null,
  obsolete boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.ai_call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.generation_jobs(id) on delete set null,
  model text not null,
  prompt_version_id uuid,
  tokens_in int, tokens_out int, cost_usd numeric, latency_ms int,
  status text, created_at timestamptz not null default now()
);
create table public.guardrail_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  rule text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anon_id text,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- admin tables (service role only) ----------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null,
  model text,
  body text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, version)
);
alter table public.ai_call_logs add foreign key (prompt_version_id) references public.prompt_versions(id) on delete set null;
create table public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_id text,
  name text not null,
  copy jsonb,
  created_at timestamptz not null default now()
);
create table public.ad_insights_daily (
  creative_id uuid not null references public.ad_creatives(id) on delete cascade,
  day date not null,
  spend numeric, impressions int, clicks int, trials int,
  primary key (creative_id, day)
);
create table public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount_usd numeric not null,
  recurrence text not null default 'once' check (recurrence in ('once','monthly')),
  incurred_on date not null default current_date,
  note text
);
create table public.revenue_daily (
  day date not null,
  tier public.tier not null,
  gross_usd numeric not null default 0,
  fees_usd numeric not null default 0,
  refunds_usd numeric not null default 0,
  primary key (day, tier)
);

-- helpful indexes
create index on public.workout_plans(user_id);
create index on public.workout_sessions(user_id, started_at desc);
create index on public.set_logs(user_id, session_id);
create index on public.meals(user_id, plan_id);
create index on public.generation_jobs(user_id, created_at desc);
create index on public.analytics_events(name, created_at desc);
