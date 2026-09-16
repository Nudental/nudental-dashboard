# Urgent request optional fields

PH5-SUPPLY-020 — live failure reproduced twice; candidate awaiting QA retest.

Using QA Super Admin, a labeled custom request for QA / Office A with a reason and optional catalog/date fields blank failed with `invalid input syntax for type uuid`. Two UI submissions and bounded readbacks confirmed zero urgent records/audits. No email/SMS functions exist in this QA project, and insertion failed before any notification attempt.

The form sends empty strings for optional `department_id`, `subsection_id`, `item_id` and `needed_by_date`. The service previously inserted them directly. The targeted repair clones the request and converts only empty values in those four typed fields to null. Valid values, omitted columns, free text, authenticated requester and submitted status are preserved. No schema, policy or notification code changes.

Nine focused service tests: baseline four pass/five fail; candidate all nine pass. All 1,541 retained frontend tests pass, zero skips. QA build, 511-file source parity and artifact isolation checks pass. Evidence: `qa-urgent-request-20260916.json`; labeled fixture `QA TEMP PH5-URGENT-20260916`. Live fixed save, persistence and cleanup still required. Audit/notification/state-transition behavior is a separate verification step.
