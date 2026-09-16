-- PH5-AUDIT-009: record catalog mutations atomically in the existing audit log.
-- No historical events are invented and no audit access rules are changed.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment', true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Front Desk catalog audit repair requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;
CREATE FUNCTION dashboard_qa.audit_front_desk_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $fn$
BEGIN
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)-'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW)-'updated_at') THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,old_values,new_values,changed_fields)
  VALUES (
    auth.uid(),TG_OP,'front_desk_inventory',
    CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    CASE WHEN TG_OP='UPDATE' THEN ARRAY(
      SELECT n.key FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
      WHERE n.value IS DISTINCT FROM o.value ORDER BY n.key
    ) ELSE NULL END
  );
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION dashboard_qa.audit_front_desk_catalog() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard_qa_front_desk_catalog_audit
AFTER INSERT OR UPDATE OR DELETE ON public.front_desk_inventory
FOR EACH ROW EXECUTE FUNCTION dashboard_qa.audit_front_desk_catalog();
COMMIT;
