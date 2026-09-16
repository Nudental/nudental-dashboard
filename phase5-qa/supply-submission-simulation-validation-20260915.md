# Safe QA supply submission

QA submission simulation — PASS for Clinical Supply, September 15, 2026.

Actual service/component tests showed QA submissions still selected provider
notification paths. All network calls in that reproduction were stubbed; no
provider was contacted. Three QA cases failed while three production cases
passed. The QA service now uses a caller-authorized submission RPC, and the
Front Desk form skips its separate provider email call only in QA. All six
actual-code cases pass; production paths retain their original behavior.

Migration 027 atomically records submitted status/audit and two internal
`dashboard_qa.execution_intents` rows (`supply_email_qa`, `supply_sms_qa`). The
trigger has no HTTP/provider calls. Duplicate submission is a no-op. Empty,
stale and unauthorized requests are rejected; audit failure rolls back status
and mock intents. These are simulations, not delivery confirmations.

Source `3ce99aa0d2b622a287cf0936d1af0dede3a63c23`, pushed.
Migration applied only to `hvtxjfayenqnwtaisoaw`; saved receipt
`542e3e2d-4481-4f90-8a3d-60e8daa726f7`. Caller execution, anonymous denial and
the single enabled mock trigger verified. QA deployment
`e78561c5-3dba-4667-a256-81baa465918f`, entry `assets/index-nYTc1sJJ.js`,
8,829,562 bytes, SHA-256
`350b3486a78d0277305d30477faa899c89a4932aaf4686bc030f94a561da291c`.
Rollback `c5cd11d1-b211-4c14-bd2f-4f67eacf1a48` retained.

Tests: 1,397 retained frontend tests, 17 PostgreSQL submission checks, 56 checks
across 27 migrations, QA build/510-file parity and 17 hosted checks: PASS.

Live Clinical Supply: normal "Submit for Review" reports success and shows
SUBMITTED. Same single labeled batch/item, one `status_submitted` audit in
addition to the prior draft audit. Eighteen live checks pass: duplicate submission
does not change records/audits, stale draft save cannot revert submission, all
eleven other configured identities denied for this clinical request. Overview
shows one pending clinical request. Private QA SQL readback after those tests
shows exactly one mocked email intent and one mocked SMS intent, both
`notification.simulate`, both linked to this submitted request.

This does not claim a completed Front Desk ordinary-role UI test or completed
review/fulfillment workflows; those remain next. Original Office A test request
is retained for them; cleanup remains required. No real email/SMS/order or
production deployment. Production remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.
