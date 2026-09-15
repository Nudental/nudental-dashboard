# PH5-IMPLANT-005 — Scanner failure reduces stock without a usage record

The actual scanner save service was executed with an existing QA Super Admin
session against one uniquely labeled disposable inventory record. Consuming one
unit failed with PGRST204: the usage schema has no `expiration_date` column.
Nevertheless stock fell from five to four, with zero usage rows and zero audits.
The probe was cleaned up. This test needs no camera access.

The scanner service duplicated stock deduction in a separate UPDATE before its
INSERT, used several columns from a different usage schema, and could therefore
lose stock on failure (or deduct twice after a valid insert). The existing usage
trigger also silently clamped insufficient stock to zero.

The targeted correction uses existing staff_assistant and procedure_notes fields,
retains inventory metadata through the inventory link, and submits one usage row
per unit as one atomic INSERT. This preserves the existing schema's unit model
and monthly count. Invalid/noninteger quantities are rejected before writes.
There is no separate inventory update; audit occurs only after successful insert.

QA migration 016 strengthens the existing stock trigger to require an available
in-stock unit and raise an error when unavailable. A failed batch rolls back all
its rows and deductions. The last unit changes inventory status to used. The
existing active-account and linked-office guard remains in place; no policies,
roles, credentials or business records are changed by the migration.

Ten actual-service tests reproduce nine failures before editing and now pass.
Eleven offline PostgreSQL checks pass for single/multiple units, last-unit status,
and rollback of an insufficient-stock batch. All 34 QA installation/coexistence
checks pass, including rejection outside QA. All 1,299 retained frontend tests
pass with zero skips. QA build/environment checks pass.

Candidate entry `index-CEQWBUg0.js`, 8,828,417 bytes, SHA256
`9255f978a40aaf804d45b856b0026dc31c50325a82a921e0c56137abc4e4a812`.
Live QA migration/release and atomic/concurrent-save repeat are pending.
Production remains unchanged. Original evidence:
`qa-implant-consume-original-20260915.json` (cleanup complete).
