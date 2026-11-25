-- E-14 review fix: plan_swaps slugs can reach the planner prompt, so they must be catalog slugs only,
-- never free text. The foreign keys make that a database rule; the format check is a second guard.
-- Rows written before this migration that are not catalog slugs are removed first.
delete from public.plan_swaps
where from_slug !~ '^[a-z0-9][a-z0-9-]{0,63}$'
   or to_slug !~ '^[a-z0-9][a-z0-9-]{0,63}$'
   or not exists (select 1 from public.exercises e where e.slug = plan_swaps.from_slug)
   or not exists (select 1 from public.exercises e where e.slug = plan_swaps.to_slug);

alter table public.plan_swaps
  add constraint plan_swaps_from_slug_fkey foreign key (from_slug) references public.exercises(slug) on delete cascade,
  add constraint plan_swaps_to_slug_fkey foreign key (to_slug) references public.exercises(slug) on delete cascade,
  add constraint plan_swaps_slug_format check (from_slug ~ '^[a-z0-9][a-z0-9-]{0,63}$' and to_slug ~ '^[a-z0-9][a-z0-9-]{0,63}$');
