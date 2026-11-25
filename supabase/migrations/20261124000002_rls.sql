-- E-02: RLS. Service role bypasses RLS. Admin tables: RLS on, no policies => service-role only.

-- Per-user tables with full own-row access
do $$
declare t text;
begin
  foreach t in array array['workout_plans','workout_days','planned_exercises','workout_sessions',
    'set_logs','nutrition_plans','meals','shopping_list_items','body_metrics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
  end loop;
end $$;

-- profiles: own row, full access
alter table public.profiles enable row level security;
create policy profiles_own on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- read-only own rows (writes happen server-side with the service role)
alter table public.entitlements enable row level security;
create policy entitlements_select_own on public.entitlements for select to authenticated using (user_id = auth.uid());
alter table public.generation_jobs enable row level security;
create policy generation_jobs_select_own on public.generation_jobs for select to authenticated using (user_id = auth.uid());
alter table public.memory_facts enable row level security;
create policy memory_facts_select_own on public.memory_facts for select to authenticated using (user_id = auth.uid());
create policy memory_facts_delete_own on public.memory_facts for delete to authenticated using (user_id = auth.uid());

-- catalog: read-only for authenticated
do $$
declare t text;
begin
  foreach t in array array['exercises','exercise_muscles','recipes','ingredients','recipe_ingredients'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
  end loop;
end $$;

-- service-role only (RLS on, no policies)
do $$
declare t text;
begin
  foreach t in array array['ai_call_logs','guardrail_events','analytics_events','admins','admin_audit_log',
    'prompt_versions','ad_creatives','ad_insights_daily','cost_entries','revenue_daily'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
