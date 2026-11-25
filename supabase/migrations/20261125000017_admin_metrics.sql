-- E-31: data for the admin Overview, Funnel and AI health screens.

-- Which price a subscriber is on (the Stripe lookup key, e.g. pro_annual). Set by the webhook; MRR needs it to tell
-- monthly from annual. Old rows stay null and are counted as monthly.
alter table public.entitlements add column price_key text;

-- ---------- Funnel ----------
-- Every event with a stitched visitor and the visitor's source. Anonymous quiz events carry an anon id; once a person
-- signs in, their events carry both ids, so the anon id is used for the whole journey. The source is the UTM source
-- saved on the profile, else the one on the visitor's landing_view, else "(direct)".
create view public.analytics_events_attributed with (security_invoker = true) as
with stitch as (
  select user_id, min(anon_id) as anon_id
    from public.analytics_events
   where user_id is not null and anon_id is not null
   group by user_id
), landing as (
  select anon_id,
         (array_agg(props ->> 'utm_source' order by created_at))[1] as utm_source,
         (array_agg(props ->> 'utm_campaign' order by created_at))[1] as utm_campaign
    from public.analytics_events
   where name = 'landing_view' and anon_id is not null
   group by anon_id
)
select e.id,
       e.created_at,
       e.created_at::date as day,
       e.name,
       e.props,
       coalesce(s.anon_id, e.anon_id, e.user_id::text) as visitor,
       coalesce(nullif(p.attribution ->> 'utm_source', ''), l.utm_source, '(direct)') as source,
       coalesce(nullif(p.attribution ->> 'utm_campaign', ''), l.utm_campaign, '(none)') as campaign
  from public.analytics_events e
  left join stitch s on s.user_id = e.user_id
  left join public.profiles p on p.user_id = e.user_id
  left join landing l on l.anon_id = coalesce(s.anon_id, e.anon_id);

create view public.funnel_by_source_daily with (security_invoker = true) as
  select day, source, name,
         count(*)::int as events,
         count(distinct visitor)::int as visitors
    from public.analytics_events_attributed
   group by 1, 2, 3;

-- Onboarding drop-off: visitors who saw each of the 13 screens.
create view public.onboarding_screens_daily with (security_invoker = true) as
  select day, source,
         (props ->> 'screen')::int as screen,
         count(distinct visitor)::int as visitors
    from public.analytics_events_attributed
   where name = 'onboarding_step_viewed' and props ? 'screen'
   group by 1, 2, 3;

-- ---------- AI health ----------
-- One row per day: generations and how they ended. `result` is the pipeline result stored by generate-plan.
create view public.generation_daily with (security_invoker = true) as
  select created_at::date as day,
         count(*)::int as jobs,
         count(*) filter (where status = 'done')::int as done,
         count(*) filter (where status = 'failed')::int as failed,
         count(distinct user_id)::int as users,
         -- first attempt passed validation and QA
         count(*) filter (where status = 'done' and result -> 'attempts' -> 0 ->> 'outcome' = 'passed')::int as first_pass,
         -- needed more than one planner attempt
         count(*) filter (where status = 'done' and jsonb_array_length(coalesce(result -> 'attempts', '[]'::jsonb)) > 1)::int as retried,
         count(*) filter (where status = 'done' and result ->> 'source' = 'escalation')::int as escalated,
         count(*) filter (where status = 'done' and result ->> 'source' = 'template')::int as fallback,
         count(*) filter (where needs_review)::int as needs_review
    from public.generation_jobs
   group by 1;

-- One row per attempt of a finished generation: what happened and why (validator and QA messages are ours, never
-- the user's text), so failures can be grouped by type.
create view public.generation_attempts with (security_invoker = true) as
  select j.id as job_id,
         j.created_at::date as day,
         j.kind,
         a.ord::int as attempt_no,
         a.value ->> 'stage' as stage,
         a.value ->> 'outcome' as outcome,
         coalesce(a.value -> 'errors', '[]'::jsonb) as errors
    from public.generation_jobs j,
         jsonb_array_elements(coalesce(j.result -> 'attempts', '[]'::jsonb)) with ordinality as a(value, ord)
   where j.status = 'done';

create view public.ai_latency_daily with (security_invoker = true) as
  select created_at::date as day,
         role,
         count(*)::int as calls,
         round(percentile_cont(0.5) within group (order by latency_ms))::int as p50_ms,
         round(percentile_cont(0.95) within group (order by latency_ms))::int as p95_ms
    from public.ai_call_logs
   where latency_ms is not null
   group by 1, 2;

revoke all on public.analytics_events_attributed, public.funnel_by_source_daily, public.onboarding_screens_daily,
  public.generation_daily, public.generation_attempts, public.ai_latency_daily from public, anon, authenticated;
grant select on public.analytics_events_attributed, public.funnel_by_source_daily, public.onboarding_screens_daily,
  public.generation_daily, public.generation_attempts, public.ai_latency_daily to service_role;
