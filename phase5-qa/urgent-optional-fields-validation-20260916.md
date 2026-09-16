# Urgent request optional fields

PH5-SUPPLY-020 — live failure reproduced twice; optional-field save repaired and live verified in QA.

Using QA Super Admin, a labeled custom request for QA / Office A with a reason and optional catalog/date fields blank failed with `invalid input syntax for type uuid`. Two UI submissions and bounded readbacks confirmed zero urgent records/audits. No email/SMS functions exist in this QA project, and insertion failed before any notification attempt.

The form sends empty strings for optional `department_id`, `subsection_id`, `item_id` and `needed_by_date`. The service previously inserted them directly. The targeted repair clones the request and converts only empty values in those four typed fields to null. Valid values, omitted columns, free text, authenticated requester and submitted status are preserved. No schema, policy or notification code changes.

Nine focused service tests: baseline four pass/five fail; candidate all nine pass. All 1,541 retained frontend tests pass, zero skips. QA build, 511-file source parity, artifact isolation and 17 hosted checks pass.

QA deployment `0abbfd1e-34dc-4e04-a2ae-10dd7537bb5d`, source `3e04d50264b13ee206eef16effe0f84985bb8603`, entry `assets/index-uQxb8Ci5.js` (SHA-256 `bc27df67867e121cd1ef88c75829ff011ed3c1b68faf59fc03150ed7bbaffe1c`). Prior QA deployment `14401159-5b87-4427-abd3-b8e73fad57a0` is preserved; production/main/API unchanged.

Original live save PASS: the same custom name, Office A and reason with optional IDs/date blank created exactly one Submitted request. UI displayed one Unacknowledged and the correct label, unit and quantity; full refresh/readback retained it. Separate verified gap: no supply audit was recorded for creation, or for its following acknowledgment. The existing UI claims notification although the isolated project has no deployed provider functions. These remain follow-up defects; this field repair does not claim the entire urgent workflow is verified.

Evidence: `qa-urgent-request-20260916.json`; labeled fixture `QA TEMP PH5-URGENT-20260916` is retained for audit/role/status checks and still requires cleanup. No stock, vendor, provider or real business record changed.
