-- E-17: Stripe subscriptions. Webhook idempotency, the past-due grace window and the access function.

alter table public.entitlements add column past_due_since timestamptz;

-- One row per processed Stripe event: the primary key makes webhook deliveries idempotent. Service role only.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- Access to a feature. Active/trialing, or past_due within 7 days of the first failed payment, AND a
-- current period that has not ended. 'basic' (default) = any paid tier; every other feature needs pro or elite.
create function public.has_access(p_user uuid, p_feature text default 'basic')
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select e.tier <> 'none'
      and e.current_period_end is not null
      and e.current_period_end > now()
      and (
        e.status in ('active', 'trialing')
        or (e.status = 'past_due' and e.past_due_since is not null and now() < e.past_due_since + interval '7 days')
      )
      and (coalesce(p_feature, 'basic') = 'basic' or e.tier in ('pro', 'elite'))
    from public.entitlements e where e.user_id = p_user
  ), false);
$$;
-- Callers may only ask about themselves; Edge Functions (service role) may ask about anyone.
revoke all on function public.has_access(uuid, text) from public;
grant execute on function public.has_access(uuid, text) to service_role;
create function public.my_access(p_feature text default 'basic')
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access(auth.uid(), p_feature);
$$;
grant execute on function public.my_access(text) to authenticated;
