-- E-71: a swap can change the portions, so the new meal keeps the slot's kcal (0.5 steps). Null = the slot keeps its portions.
-- The table's RLS policy and grants (E-15, E-69) already cover the new column.
alter table public.meal_swaps add column portions numeric(3,1) check (portions is null or (portions >= 0.5 and portions <= 6));
