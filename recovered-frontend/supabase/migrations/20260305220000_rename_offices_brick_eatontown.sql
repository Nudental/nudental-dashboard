-- Migration: Rename office locations
-- Brick -> Nu Dental of Brick
-- Eatontown -> Nu Dental of Eatontown

UPDATE public.offices
SET name = 'Nu Dental of Brick'
WHERE name = 'Brick';

UPDATE public.offices
SET name = 'Nu Dental of Eatontown'
WHERE name = 'Eatontown';
