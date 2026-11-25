-- E-61: explicit table privileges for the Supabase API roles.
-- Newer Supabase projects do not expose tables to the Data API automatically: without these grants, RLS policies
-- never apply because `authenticated` cannot reach the tables ("42501 permission denied for table ...").
-- Rule: every new table migration enables RLS, adds policies AND grants the roles that use it.
-- Function EXECUTE is left as the earlier migrations set it (has_access, erase_user_traces, purge_guardrail_text stay closed).

grant usage on schema public to anon, authenticated, service_role;

-- Server side (Edge Functions, admin): everything.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Signed-in users: only what each table's RLS policies cover.
grant select, insert, update, delete on
  public.body_metrics, public.meals, public.nutrition_plans, public.plan_swaps, public.planned_exercises,
  public.profiles, public.push_tokens, public.set_logs, public.workout_days, public.workout_plans,
  public.workout_sessions, public.meal_swaps, public.shopping_list_items
  to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select, delete on public.memory_facts to authenticated;
grant select on
  public.entitlements, public.exercise_muscles, public.exercises, public.generation_jobs, public.ingredients,
  public.recipe_ingredients, public.recipes, public.plan_prices
  to authenticated;

-- Visitors (the paywall prices): read-only, one table.
grant select on public.plan_prices to anon;

-- Future tables: the server role gets access automatically; anon/authenticated must be granted explicitly per table.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
