-- E-16: shopping list. The list itself is derived from the current nutrition plan (so it follows plan changes
-- and meal swaps); only the checked state is stored, one row per ingredient per nutrition job. RLS: own rows (see rls migration).
alter table public.shopping_list_items
  add column job_id uuid references public.generation_jobs(id) on delete cascade;
create unique index shopping_list_items_job_label on public.shopping_list_items(user_id, job_id, label);
