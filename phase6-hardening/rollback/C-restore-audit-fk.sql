-- Restore the original FK without deleting audit history created after release.
-- Invoke inside the bounded Group C rollback transaction, after writer restore.
DO $rollback$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conrelid='public.bone_tissue_audit_log'::regclass
     AND conname='bone_tissue_audit_log_record_id_fkey'
 ) THEN
   ALTER TABLE public.bone_tissue_audit_log
     ADD CONSTRAINT bone_tissue_audit_log_record_id_fkey
     FOREIGN KEY (record_id) REFERENCES public.bone_tissue_inventory(id)
     ON DELETE CASCADE NOT VALID;
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.bone_tissue_audit_log a
   WHERE a.record_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM public.bone_tissue_inventory i WHERE i.id=a.record_id
   )
 ) THEN
   ALTER TABLE public.bone_tissue_audit_log
     VALIDATE CONSTRAINT bone_tissue_audit_log_record_id_fkey;
 END IF;
END;
$rollback$;
