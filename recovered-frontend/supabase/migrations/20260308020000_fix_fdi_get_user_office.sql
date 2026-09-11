-- Fix fdi_get_user_office() function
-- user_profiles has office_id (UUID FK to offices.id), not office_name
CREATE OR REPLACE FUNCTION public.fdi_get_user_office()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT o.name
  FROM public.user_profiles up
  JOIN public.offices o ON o.id = up.office_id
  WHERE up.id = auth.uid()
  LIMIT 1;
$$;
