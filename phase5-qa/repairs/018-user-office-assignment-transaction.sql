-- QA-only PH5-USERS-003: replace office assignments and primary office together.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Office assignment repair requires the isolated Dashboard QA schema';
  END IF;
END;
$qa_guard$;

CREATE OR REPLACE FUNCTION public.dashboard_set_user_offices(
  p_user_id uuid, p_office_ids uuid[], p_all_offices boolean DEFAULT false
)
RETURNS SETOF public.user_office_assignments
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_primary uuid;
  v_offices uuid[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id=auth.uid() AND role IN ('admin','super_admin')
      AND is_active=true AND is_approved=true AND status='Active'
  ) THEN
    RAISE EXCEPTION 'Only an active administrator can assign offices' USING ERRCODE='42501';
  END IF;
  IF array_position(p_office_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Office identifiers cannot contain null' USING ERRCODE='22023';
  END IF;
  SELECT ARRAY(
    SELECT item.id FROM unnest(COALESCE(p_office_ids, '{}'::uuid[]))
      WITH ORDINALITY AS item(id, position)
    GROUP BY item.id ORDER BY min(item.position)
  ) INTO v_offices;

  -- Serialize changes to the same account; ordinary RLS remains in force.
  SELECT office_id INTO v_primary FROM public.user_profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile is unavailable' USING ERRCODE='42501';
  END IF;
  IF NOT COALESCE(p_all_offices,false) AND NOT COALESCE(v_primary=ANY(v_offices),false) THEN
    v_primary := v_offices[1];
  END IF;
  UPDATE public.user_profiles SET office_id=v_primary WHERE id=p_user_id;
  DELETE FROM public.user_office_assignments WHERE user_id=p_user_id;
  IF p_all_offices THEN
    INSERT INTO public.user_office_assignments(user_id,office_id,all_offices)
      VALUES(p_user_id,NULL,true);
  ELSE
    INSERT INTO public.user_office_assignments(user_id,office_id,all_offices)
      SELECT p_user_id,id,false FROM unnest(v_offices) AS item(id);
  END IF;
  RETURN QUERY SELECT * FROM public.user_office_assignments WHERE user_id=p_user_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_set_user_offices(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_set_user_offices(uuid,uuid[],boolean) TO authenticated;
COMMIT;
