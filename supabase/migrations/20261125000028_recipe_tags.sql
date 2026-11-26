-- E-66: recipes get a meal type, a prep time and a cost tier, so the template meal plan (the fallback when the AI fails)
-- can fill real meal slots and respect cooking time and budget. No new table: `recipes` keeps its existing grants and policies.
-- The values for the base recipes are in supabase/seed/04_recipe_tags.sql. Until they are applied, every recipe reads as
-- lunch or dinner, 30 minutes, medium cost: the template still works, it just cannot pick breakfasts or snacks.
alter table public.recipes
  add column meal_types text[] not null default '{lunch,dinner}'
    check (cardinality(meal_types) >= 1 and meal_types <@ array['breakfast','lunch','dinner','snack']),
  add column prep_minutes int not null default 30 check (prep_minutes between 1 and 240),
  add column cost_tier text not null default 'medium' check (cost_tier in ('low', 'medium', 'high'));

-- candidate_recipes also returns the new fields and the ingredient names (dislikes are matched on them).
drop function public.candidate_recipes(text[], text);
create function public.candidate_recipes(p_allergens text[], p_diet text)
returns table (slug text, name text, diet text, kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, allergens text[],
               meal_types text[], prep_minutes int, cost_tier text, ingredients text[])
language sql stable security invoker set search_path = public as $$
  select r.slug, r.name, r.diet, r.kcal, r.protein_g, r.carbs_g, r.fat_g,
         coalesce((select array_agg(distinct a order by a)
                   from public.recipe_ingredients ri
                   join public.ingredients i on i.id = ri.ingredient_id,
                   unnest(i.allergens) a
                   where ri.recipe_id = r.id), '{}'),
         r.meal_types, r.prep_minutes, r.cost_tier,
         coalesce((select array_agg(i.name order by i.name)
                   from public.recipe_ingredients ri
                   join public.ingredients i on i.id = ri.ingredient_id
                   where ri.recipe_id = r.id), '{}')
  from public.recipes r
  where (p_diet = 'omnivore' or r.diet = p_diet or (p_diet = 'vegetarian' and r.diet = 'vegan'))
    and not exists (
      select 1 from public.recipe_ingredients ri
      join public.ingredients i on i.id = ri.ingredient_id
      where ri.recipe_id = r.id and i.allergens && p_allergens
    )
  order by r.slug;
$$;
