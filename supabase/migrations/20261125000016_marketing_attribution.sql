-- E-22: web funnel and ad tracking.

-- First-touch ad attribution (UTM tags, Facebook click and browser ids) captured on the landing page.
-- Saved with the profile at sign-up; used to match server-side Meta conversions. No health data.
alter table public.profiles add column attribution jsonb not null default '{}';

-- Tracking consent (the cookie banner choice). Only users with an accepted `marketing` record are ever sent to Meta.
alter table public.consent_records drop constraint consent_records_kind_check;
alter table public.consent_records
  add constraint consent_records_kind_check
  check (kind in ('terms', 'privacy', 'health_data', 'disclaimer', 'notifications', 'marketing'));
