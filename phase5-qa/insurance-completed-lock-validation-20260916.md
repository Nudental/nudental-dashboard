# Completed insurance form API lock

PH5-INSURANCE-002 — reproduced twice live in isolated QA; tested repair 041.

The UI/service explicitly locks completed verification contents. On a newly
labeled copy of an earlier wholly synthetic QA form, two Office Manager direct
API updates changed the completed notes and produced no audit event. Each notes
change was restored immediately. The page still identified the record Completed.
Only synthetic QA fields were touched; no provider or delivery action occurred.

Root cause: the lock is a browser-side status read; existing database policies
check active account, page and office access but do not make completed clinical
contents immutable. A client can bypass the service function or race completion.

Migration 041 adds a BEFORE UPDATE guard for insurance_verifications whose old
status is completed. It compares all stored contents except an explicit list of
existing PDF/delivery/chart tracking fields and updated_at. Draft editing and
completion remain possible, while completed notes, patient/form data, completion
identity/timestamps, request links and reopening are rejected. No grants,
credentials, production policies or schema data are changed. The migration
requires the existing isolated QA environment.

Thirty-seven offline PostgreSQL checks pass; 84 migration installation checks
pass across 41 repairs, including rejection outside QA. Tests cover four existing
authorized roles, the original bypass, full row preservation on failure,
unprivileged page denial, stale draft saves, allowed tracking metadata, draft
editing/completion and direct trigger-function permission. An initial test used
unchanged empty form_data and correctly did not raise; it now supplies a changed
synthetic value. The retained Storage test originally reopened its completed
fixture merely to test draft PDF denial. It now seeds a separate draft and checks
that draft access is denied while the original completed PDF remains readable;
the lock is not weakened for test setup. Hosted migration and live verification
pending.
