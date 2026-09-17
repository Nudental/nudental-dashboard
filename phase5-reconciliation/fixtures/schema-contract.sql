-- Read-only test contracts extracted from the verified QA schema; never execute as a migration.
CREATE TYPE public."user_role" AS ENUM ('staff','admin','super_admin','office_manager','regional_clinical_manager','regional_manager','insurance_verifier','marketing');
CREATE TABLE public."supply_audit_logs" (
"id" uuid NOT NULL,
"record_id" uuid,
"record_type" text,
"action" text,
"changed_by" uuid,
"changed_at" timestamp with time zone,
"old_values" jsonb,
"new_values" jsonb
);
