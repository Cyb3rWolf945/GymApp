-- E-29: instrumentation. Columns for AI call logs, guardrail retention, signup events and admin dashboard views.

-- 1. ai_call_logs: what the admin needs to judge quality and cost.
alter table public.ai_call_logs
  add column qa_result text check (qa_result in ('pass', 'fail')),
  add column retry int not null default 0,
  add column escalated boolean not null default false,
  add column refusal boolean not null default false;
create index on public.ai_call_logs(created_at desc);

-- 2. guardrail_events: the category is `rule`. The user's text is kept only for the review queue
-- (blocked / dropped / unclassified, see guardrailRow in shared) and removed after the retention window,
-- or once a reviewer has looked at it.
alter table public.guardrail_events add column reviewed_at timestamptz;

create function public.purge_guardrail_text(p_days int default 30)
returns int language sql security definer set search_path = public as $$
  with purged as (
    update public.guardrail_events
       set input_text = null
     where input_text is not null
       and (created_at < now() - make_interval(days => p_days) or reviewed_at is not null)
    returning 1
  )
  select count(*)::int from purged;
$$;
revoke all on function public.purge_guardrail_text(int) from public, anon, authenticated;
grant execute on function public.purge_guardrail_text(int) to service_role;

-- 3. signup events come from the database, so they can't be forged by a client.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (user_id) do nothing;
  insert into public.analytics_events (user_id, name, props)
  values (new.id, 'signup', jsonb_build_object('method',
    case coalesce(new.raw_app_meta_data ->> 'provider', 'email')
      when 'apple' then 'apple' when 'google' then 'google' when 'email' then 'email' else 'other' end));
  return new;
end $$;

-- 4. Daily aggregates for the admin dashboards. security_invoker: they read the service-role-only tables with the
-- caller's rights, so signed-in users still see nothing. Only the service role may select.
create view public.analytics_funnel_daily with (security_invoker = true) as
  select created_at::date as day,
         name,
         count(*)::int as events,
         count(distinct coalesce(user_id::text, anon_id))::int as visitors
    from public.analytics_events
   group by 1, 2;

create view public.ai_usage_daily with (security_invoker = true) as
  select created_at::date as day,
         role,
         model,
         count(*)::int as calls,
         coalesce(sum(tokens_in), 0)::bigint as tokens_in,
         coalesce(sum(tokens_out), 0)::bigint as tokens_out,
         coalesce(sum(cost_usd), 0) as cost_usd,
         round(avg(latency_ms))::int as avg_latency_ms,
         count(*) filter (where status <> 'ok')::int as errors,
         count(*) filter (where escalated)::int as escalated_calls,
         count(*) filter (where refusal)::int as refusals,
         count(*) filter (where qa_result = 'fail')::int as qa_fails,
         count(*) filter (where retry > 0)::int as retried_calls
    from public.ai_call_logs
   group by 1, 2, 3;

create view public.guardrail_daily with (security_invoker = true) as
  select created_at::date as day,
         field,
         rule as category,
         action,
         count(*)::int as events
    from public.guardrail_events
   group by 1, 2, 3, 4;

create view public.revenue_net_daily with (security_invoker = true) as
  select day,
         tier,
         gross_usd,
         fees_usd,
         refunds_usd,
         gross_usd - fees_usd - refunds_usd as net_usd
    from public.revenue_daily;

revoke all on public.analytics_funnel_daily, public.ai_usage_daily, public.guardrail_daily, public.revenue_net_daily
  from public, anon, authenticated;
grant select on public.analytics_funnel_daily, public.ai_usage_daily, public.guardrail_daily, public.revenue_net_daily to service_role;
