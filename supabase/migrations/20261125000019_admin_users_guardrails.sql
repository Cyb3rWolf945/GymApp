-- E-32: admin Users list (search) and the guardrails review queue.

-- Users for the backoffice, with their plan and when they were last active (last sign-in or last workout).
-- auth.users is not reachable through the API, so this function is the only door; service role only.
create function public.admin_user_list(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, email text, created_at timestamptz, last_active timestamptz,
  tier public.tier, status text, current_period_end timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select u.id,
         u.email::text,
         u.created_at,
         greatest(u.last_sign_in_at, (select max(s.started_at) from public.workout_sessions s where s.user_id = u.id)),
         coalesce(e.tier, 'none'::public.tier),
         coalesce(e.status, 'none'),
         e.current_period_end
    from auth.users u
    left join public.entitlements e on e.user_id = u.id
   where coalesce(trim(p_search), '') = ''
      or u.id::text = lower(trim(p_search))
      -- a plain "contains" search: the user's % and _ are matched literally, not as wildcards
      or u.email ilike '%' || replace(replace(replace(trim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
   order by u.created_at desc
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;
revoke all on function public.admin_user_list(text, int, int) from public, anon, authenticated;
grant execute on function public.admin_user_list(text, int, int) to service_role;

-- Guardrails review queue: what the reviewer decided. Reviewing sets `reviewed_at` (E-29), so the user's text is
-- removed by the next daily purge: it is kept only for as long as the decision needs it.
alter table public.guardrail_events
  add column review_decision text check (review_decision in ('approved', 'kept_blocked', 'contacted')),
  add column reviewed_by uuid references auth.users(id) on delete set null;
create index guardrail_events_open_queue on public.guardrail_events (created_at desc) where reviewed_at is null;
