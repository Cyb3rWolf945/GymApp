-- E-08: what the admin review queue needs. Service role only (RLS enabled, no policies).
alter table public.guardrail_events
  add column field text,
  add column input_text text,
  add column job_id uuid references public.generation_jobs(id) on delete set null;
create index on public.guardrail_events(created_at desc);
