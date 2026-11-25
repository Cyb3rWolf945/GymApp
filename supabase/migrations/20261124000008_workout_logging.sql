-- E-13: workout logging. Rows are written by the app with client-generated ids (idempotent retries),
-- so sessions work before the plan is persisted to workout_days.
alter table public.workout_sessions
  add column day_name text,
  add column rating smallint check (rating between 1 and 5);
create index on public.workout_sessions(user_id, started_at desc);
create index on public.set_logs(exercise_id, logged_at desc);
