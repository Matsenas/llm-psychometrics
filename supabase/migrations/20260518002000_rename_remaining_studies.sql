BEGIN;

UPDATE public.studies
SET name = 'Artificial and Natural Intelligence (LTAT.02.024) Project'
WHERE slug = 'big5_original';

UPDATE public.studies
SET name = 'Natural Language Processing (LTAT.01.001) Project'
WHERE slug = 'relationship_patterns_cuq_sus_plausibility';

COMMIT;
