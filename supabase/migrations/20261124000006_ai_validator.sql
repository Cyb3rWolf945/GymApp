-- E-07: candidate functions also return the safety fields the validator checks, and jobs can be flagged.
alter table public.generation_jobs add column needs_review boolean not null default false;

drop function public.candidate_exercises(text[], text[], text);
create function public.candidate_exercises(p_equipment text[], p_contraindications text[], p_level text)
returns table (slug text, name text, equipment text, level text, muscles text[], contraindications text[])
language sql stable security invoker set search_path = public as $$
  select e.slug, e.name, e.equipment, e.level,
         coalesce(array_agg(m.muscle) filter (where m.role = 'primary'), '{}'),
         e.contraindications
  from public.exercises e
  left join public.exercise_muscles m on m.exercise_id = e.id
  where (e.equipment = any (p_equipment) or e.equipment = 'bodyweight')
    and not (e.contraindications && p_contraindications)
    and array_position(array['beginner','intermediate','advanced'], e.level)
        <= array_position(array['beginner','intermediate','advanced'], p_level)
  group by e.id
  order by e.slug;
$$;

drop function public.candidate_recipes(text[], text);
create function public.candidate_recipes(p_allergens text[], p_diet text)
returns table (slug text, name text, diet text, kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, allergens text[])
language sql stable security invoker set search_path = public as $$
  select r.slug, r.name, r.diet, r.kcal, r.protein_g, r.carbs_g, r.fat_g,
         coalesce((select array_agg(distinct a order by a)
                   from public.recipe_ingredients ri
                   join public.ingredients i on i.id = ri.ingredient_id,
                   unnest(i.allergens) a
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
