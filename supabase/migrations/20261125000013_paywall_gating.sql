-- E-18: paywall and tier gating, enforced server-side.

-- 1. has_access: add the Elite-only feature and lock down who can call it.
create or replace function public.has_access(p_user uuid, p_feature text default 'basic')
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select e.tier <> 'none'
      and e.current_period_end is not null
      and e.current_period_end > now()
      and (
        e.status in ('active', 'trialing')
        or (e.status = 'past_due' and e.past_due_since is not null and now() < e.past_due_since + interval '7 days')
      )
      and case coalesce(p_feature, 'basic')
        when 'basic' then true
        when 'workouts' then true
        when 'swaps' then true
        when 'weekly_adjust' then e.tier = 'elite'
        else e.tier in ('pro', 'elite')
      end
    from public.entitlements e where e.user_id = p_user
  ), false);
$$;
-- Supabase default privileges can grant execute to anon/authenticated directly: revoke explicitly.
revoke all on function public.has_access(uuid, text) from public, anon, authenticated;
grant execute on function public.has_access(uuid, text) to service_role;
revoke all on function public.my_access(text) from public, anon;
grant execute on function public.my_access(text) to authenticated;

-- 2. Pro features write through RLS: meal swaps and the shopping list need access to those features.
drop policy meal_swaps_own on public.meal_swaps;
create policy meal_swaps_select on public.meal_swaps for select to authenticated using (user_id = auth.uid());
create policy meal_swaps_delete on public.meal_swaps for delete to authenticated using (user_id = auth.uid());
create policy meal_swaps_insert on public.meal_swaps for insert to authenticated
  with check (user_id = auth.uid() and public.my_access('nutrition'));
create policy meal_swaps_update on public.meal_swaps for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.my_access('nutrition'));

drop policy shopping_list_items_own on public.shopping_list_items;
create policy shopping_list_items_select on public.shopping_list_items for select to authenticated using (user_id = auth.uid());
create policy shopping_list_items_delete on public.shopping_list_items for delete to authenticated using (user_id = auth.uid());
create policy shopping_list_items_insert on public.shopping_list_items for insert to authenticated
  with check (user_id = auth.uid() and public.my_access('shopping'));
create policy shopping_list_items_update on public.shopping_list_items for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.my_access('shopping'));

-- 3. Prices from the database (no deploy to change a price), with A/B variants.
-- `stripe_price_id` null = resolve by lookup_key in Stripe. A variant is only shown if it covers all six plans.
create table public.plan_prices (
  lookup_key text not null,
  variant text not null default 'default',
  tier public.tier not null check (tier <> 'none'),
  interval text not null check (interval in ('month', 'year')),
  cents int not null check (cents > 0),
  stripe_price_id text,
  active boolean not null default true,
  primary key (lookup_key, variant)
);
alter table public.plan_prices enable row level security;
create policy plan_prices_read on public.plan_prices for select to anon, authenticated using (active);
insert into public.plan_prices (lookup_key, tier, interval, cents) values
  ('basic_monthly', 'basic', 'month', 999),  ('basic_annual', 'basic', 'year', 5999),
  ('pro_monthly', 'pro', 'month', 1999),     ('pro_annual', 'pro', 'year', 11999),
  ('elite_monthly', 'elite', 'month', 2499), ('elite_annual', 'elite', 'year', 14999);
