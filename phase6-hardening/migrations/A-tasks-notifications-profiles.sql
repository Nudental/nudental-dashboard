-- Phase 6 group A. Schema only. Existing permission settings and office policies are retained.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Reviewed source repair 001-profile-access-boundary.sql
-- Signup metadata is caller-controlled. Administrative role assignment belongs
-- in the existing authorized profile-write flow after the auth identity exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  INSERT INTO public.user_profiles(id,email,full_name,role)
  VALUES(NEW.id,NEW.email,
         COALESCE(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1)),
         'staff'::public.user_role)
  ON CONFLICT(id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_access_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_admin boolean := false;
  v_access_changed boolean := false;
BEGIN
  -- Auth provisioning and a service-role/SQL administrator retain their existing
  -- trusted setup path. Browser requests remain governed by existing row policies.
  IF v_actor IS NULL OR auth.role() = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id=v_actor AND role IN ('admin','super_admin')
      AND is_active=true AND is_approved=true AND status='Active'
  ) INTO v_admin;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_admin THEN
      RAISE EXCEPTION 'Only an active administrator can remove a user profile'
        USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_access_changed := NEW.role IS DISTINCT FROM 'staff'::public.user_role
      OR NEW.office_id IS NOT NULL
      OR NEW.is_active IS DISTINCT FROM true
      OR NEW.is_approved IS DISTINCT FROM false
      OR NEW.status IS DISTINCT FROM 'Pending'
      OR COALESCE(NEW.has_executive_view,false)
      OR COALESCE(NEW."dashboard:executive_overview",false);
  ELSE
    v_access_changed := ROW(NEW.role,NEW.office_id,NEW.is_active,NEW.is_approved,
                            NEW.status,NEW.has_executive_view,NEW."dashboard:executive_overview")
        IS DISTINCT FROM ROW(OLD.role,OLD.office_id,OLD.is_active,OLD.is_approved,
                            OLD.status,OLD.has_executive_view,OLD."dashboard:executive_overview");
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'A user profile cannot be rebound to another identity'
        USING ERRCODE='42501';
    END IF;
  END IF;
  IF v_access_changed AND NOT v_admin THEN
    RAISE EXCEPTION 'Only an active administrator can change profile access'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.guard_profile_access_fields() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_guard_profile_access_fields ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_guard_profile_access_fields ON public.user_profiles;
CREATE TRIGGER trg_guard_profile_access_fields
BEFORE INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_access_fields();

-- Reviewed source repair 002-office-workflow-boundary.sql
CREATE OR REPLACE FUNCTION public.dashboard_has_active_profile()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles
    WHERE id=auth.uid() AND is_active=true AND is_approved=true AND status='Active'
  );
$function$;

-- A restrictive boundary combines with, rather than competes with, the existing
-- permissive policies. Existing task assignee and role restrictions still apply.
DROP POLICY IF EXISTS dashboard_tasks_active_office_boundary ON public.action_items;
CREATE POLICY dashboard_tasks_active_office_boundary
ON public.action_items AS RESTRICTIVE FOR ALL TO authenticated
USING (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id))
WITH CHECK (public.dashboard_has_active_profile() AND public.user_can_access_office(office_id));


-- Reviewed source repair 008-task-page-permission.sql
DROP POLICY IF EXISTS dashboard_tasks_page_permission ON public.action_items;
CREATE POLICY dashboard_tasks_page_permission
ON public.action_items AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
  (p.role='super_admin' OR EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role=p.role::text AND rp.permission='workflow.tasks.view' AND rp.enabled=true
  ))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid() AND
  (p.role='super_admin' OR EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role=p.role::text AND rp.permission='workflow.tasks.view' AND rp.enabled=true
  ))
));

-- Reviewed source repair 009-task-field-permission.sql
CREATE OR REPLACE FUNCTION public.dashboard_guard_task_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  lifecycle_fields text[] := ARRAY[
    'task_status','updated_at','acknowledged_at','acknowledged_by',
    'in_progress_at','in_progress_by','completed_at','completed_by'
  ];
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid()
      AND role::text IN ('super_admin','admin','office_manager','regional_manager','regional_clinical_manager'))
     AND (to_jsonb(NEW) - lifecycle_fields) IS DISTINCT FROM (to_jsonb(OLD) - lifecycle_fields) THEN
    RAISE EXCEPTION 'Task field edits require a task manager role' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_task_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_task_field_guard ON public.action_items;
CREATE TRIGGER trg_dashboard_task_field_guard BEFORE UPDATE
ON public.action_items FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_task_fields();

-- Reviewed source repair 010-notification-audit-coverage.sql
DROP TRIGGER IF EXISTS trg_audit_notifications ON public.notifications;
CREATE TRIGGER trg_audit_notifications AFTER INSERT OR UPDATE OR DELETE
ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Reviewed source repair 013-task-identity-boundary.sql
CREATE OR REPLACE FUNCTION public.dashboard_guard_task_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  stage text;
  previous jsonb;
  incoming jsonb := to_jsonb(NEW);
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid()
       OR NOT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid()
          AND role::text IN ('super_admin','admin','office_manager','regional_manager','regional_clinical_manager'))
       OR NEW.task_status NOT IN ('pending','submitted')
       OR NEW.acknowledged_at IS NOT NULL OR NEW.acknowledged_by IS NOT NULL
       OR NEW.in_progress_at IS NOT NULL OR NEW.in_progress_by IS NOT NULL
       OR NEW.completed_at IS NOT NULL OR NEW.completed_by IS NOT NULL THEN
      RAISE EXCEPTION 'New tasks require their manager creator and an initial state' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Task creator is immutable' USING ERRCODE='42501';
  END IF;
  previous := to_jsonb(OLD);
  FOREACH stage IN ARRAY ARRAY['acknowledged','in_progress','completed'] LOOP
    IF (incoming ->> (stage || '_at')) IS DISTINCT FROM (previous ->> (stage || '_at'))
       OR (incoming ->> (stage || '_by')) IS DISTINCT FROM (previous ->> (stage || '_by')) THEN
      IF (previous ->> (stage || '_at')) IS NOT NULL OR (previous ->> (stage || '_by')) IS NOT NULL THEN
        RAISE EXCEPTION 'Existing task lifecycle metadata is immutable' USING ERRCODE='42501';
      END IF;
      IF NEW.task_status IS DISTINCT FROM stage OR NEW.task_status IS NOT DISTINCT FROM OLD.task_status
         OR (incoming ->> (stage || '_at')) IS NULL
         OR (incoming ->> (stage || '_by')) IS DISTINCT FROM auth.uid()::text THEN
        RAISE EXCEPTION 'Task lifecycle metadata requires the current actor and matching transition' USING ERRCODE='42501';
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.dashboard_guard_task_identity() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_dashboard_task_identity_guard ON public.action_items;
CREATE TRIGGER trg_dashboard_task_identity_guard BEFORE INSERT OR UPDATE
ON public.action_items FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_task_identity();

-- Reviewed source repair 014-task-row-audit.sql
DROP TRIGGER IF EXISTS trg_audit_action_items ON public.action_items;
CREATE TRIGGER trg_audit_action_items
AFTER INSERT OR UPDATE OR DELETE ON public.action_items
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- Reviewed source repair 018-user-office-assignment-transaction.sql
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


-- Preserve the existing writer, ACL and failure semantics; capture actor role at event time.
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_action       TEXT;
  v_old_values   JSONB := NULL;
  v_new_values   JSONB := NULL;
  v_record_id    UUID := NULL;
  v_user_id      UUID := NULL;
  v_changed_fields TEXT[] := NULL;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action     := 'INSERT';
    v_new_values := to_jsonb(NEW);
    -- Try to extract id field
    BEGIN v_record_id := (to_jsonb(NEW)->>'id')::UUID; EXCEPTION WHEN OTHERS THEN NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action     := 'UPDATE';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    BEGIN v_record_id := (to_jsonb(NEW)->>'id')::UUID; EXCEPTION WHEN OTHERS THEN NULL; END;
    -- Capture which fields changed
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value;
  ELSIF TG_OP = 'DELETE' THEN
    v_action     := 'DELETE';
    v_old_values := to_jsonb(OLD);
    BEGIN v_record_id := (to_jsonb(OLD)->>'id')::UUID; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- Attempt to get current user from auth.uid()
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Insert audit record (fire-and-forget, never block the original operation)
  BEGIN
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values,
      changed_fields,
      created_at,
      change_summary
    ) VALUES (
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      v_record_id,
      v_old_values,
      v_new_values,
      v_changed_fields,
      NOW(),
      jsonb_build_object(
        'actor_role',(SELECT p.role::text FROM public.user_profiles p WHERE p.id=v_user_id),
        'actor_office_id',(SELECT p.office_id FROM public.user_profiles p WHERE p.id=v_user_id),
        'record_office_id',coalesce(v_new_values->>'office_id',v_old_values->>'office_id'),
        'source','database_trigger'
      )::text
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let audit failure block the main operation
    NULL;
  END;

  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$
;
COMMIT;
