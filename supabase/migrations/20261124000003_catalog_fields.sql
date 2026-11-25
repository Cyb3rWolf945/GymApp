-- E-03: catalog fields the seed needs. Lists mirror packages/shared/src/catalog/catalog.ts.

alter table public.exercises
  add column level text not null default 'beginner'
    check (level in ('beginner','intermediate','advanced')),
  add column contraindications text[] not null default '{}'
    check (contraindications <@ array['knee','shoulder','lower_back','elbow','wrist','hip','neck']::text[]),
  add constraint exercises_equipment_check
    check (equipment in ('full_gym','basic_gym','dumbbells','barbell','kettlebell','bands','bodyweight'));

alter table public.ingredients
  add column category text
    check (category in ('produce','meat','fish_seafood','dairy','eggs','grains','legumes','plant_protein','nuts_seeds','fats_oils','condiments','spices')),
  add column allergens text[] not null default '{}'
    check (allergens <@ array['gluten','lactose','nuts','shellfish','egg','soy','fish']::text[]);

-- Recipe allergens are not stored: they derive from ingredients (see deriveAllergens in shared).
alter table public.recipes
  add column diet text not null default 'omnivore'
    check (diet in ('omnivore','vegetarian','vegan'));
