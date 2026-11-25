-- E-55: coach style (tone of plan rationales, feedback and in-app encouragement). Default Calm. RLS unchanged:
-- profiles are already own-row only, and a user changes their own style like any other profile field.
alter table public.profiles
  add column coach_style text not null default 'calm' check (coach_style in ('calm', 'direct', 'hype'));
