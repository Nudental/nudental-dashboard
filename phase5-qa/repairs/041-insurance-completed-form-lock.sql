-- Enforce the existing completed-form lock below the browser/service layer.
BEGIN;
DO $qa_guard$
BEGIN
  IF current_setting('nudashboard.environment',true) IS DISTINCT FROM 'qa'
     OR to_regnamespace('dashboard_qa') IS NULL THEN
    RAISE EXCEPTION 'Completed insurance form lock requires isolated Dashboard QA';
  END IF;
END;
$qa_guard$;

CREATE FUNCTION dashboard_qa.guard_completed_insurance_form()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog
AS $fn$
DECLARE
  tracking_columns text[]:=ARRAY[
    'updated_at','pdf_storage_path','pdf_generated_at','pdf_checksum_sha256',
    'office_emailed_at','office_email_to','chart_upload_method','chart_upload_status',
    'dentrix_document_upload_status','dentrix_document_id','dentrix_patient_id',
    'dentrix_document_uploaded_at','dentrix_document_uploaded_by','dentrix_document_upload_error',
    'dentrix_document_filename','dentrix_document_mime_type','dentrix_document_size_bytes',
    'manual_chart_uploaded_at','manual_chart_uploaded_by','manual_chart_upload_note',
    'chart_uploaded_at','chart_uploaded_by_user_id','chart_upload_error'
  ];
BEGIN
  IF OLD.status='completed'
     AND (to_jsonb(NEW)-tracking_columns) IS DISTINCT FROM (to_jsonb(OLD)-tracking_columns) THEN
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='This verification is completed and locked. Form contents cannot be changed.';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION dashboard_qa.guard_completed_insurance_form() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard_qa_completed_insurance_form_lock
BEFORE UPDATE ON public.insurance_verifications
FOR EACH ROW EXECUTE FUNCTION dashboard_qa.guard_completed_insurance_form();
COMMIT;
