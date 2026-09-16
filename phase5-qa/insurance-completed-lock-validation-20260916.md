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
the lock is not weakened for test setup. All retained insurance access (50) and
Storage (32) checks pass as well.

Hosted repair 041 applied only to hvtxjfayenqnwtaisoaw. Saved SQL evidence:
c7d45cbd-f15d-4946-8760-e84d6f9453f6; trigger enabled, snippet saved.
Both original Office Manager notes bypasses now fail, preserving the row and
audit count. Positive API controls verify PDF metadata write/readback/restore,
draft edit/readback, completion/readback, stale-save rejection and no duplicate
verification. These API controls do not claim UI-generated audit events or actual
PDF delivery. The test initially supplied invalid request status `new`; the
existing constraint rejected it before insertion. Correcting the fixture to the
application's `requested` status allowed the intended test.

After a fresh browser reload the completed form has 24 read-only text fields,
19 read-only numeric fields and no Save Draft/Mark Completed controls. Both exact
temporary requests and verifications were removed; repeated deletes returned
zero. No PDF object or provider action occurred; no audit row was erased.
Receipt: qa-insurance-lock-20260916.json, cleanup_verified=true. QA frontend and
API releases are unchanged; production was not deployed or modified.
