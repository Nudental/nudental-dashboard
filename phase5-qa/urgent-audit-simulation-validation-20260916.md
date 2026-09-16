# Urgent request audit and QA notification simulation

PH5-AUDIT-012 / PH5-QA-SUPPLY-021 — candidate, not yet applied or live verified.

The labeled QA urgent request saved and acknowledged successfully, but both readbacks showed zero audit events. The UI also claims the regional manager was notified even though this isolated project has no deployed Edge Functions. Source confirms independent writes with no audit trigger and fire-and-forget requests to the old notification functions.

Candidate 038 adds transactional create/change/delete history for urgent requests and two private, mock-only notification intents on creation. A failed audit or intent rolls back the request. Timestamp-only updates and repeat deletes add no audit. Existing histories are preserved; past missing events are not manufactured. The trigger cannot be called directly by anonymous/authenticated clients. New audit entries use existing active-account, monthly-supply page and office checks; direct client inserts of this audit class are refused. Existing request-table policies remain unchanged, including their separately unverified access gap. Other audit classes and pending access candidates 032/034/035 are unchanged.

The QA frontend returns after the successful insert transaction instead of invoking email/SMS functions, and explicitly describes simulations with no email/SMS sent. Production keeps its existing provider calls and wording. No provider credentials, policies on request records, billing or production configuration change.

Validation: 47 offline PostgreSQL cases (audit/intent rollback, all 12 identity history scopes, forgery rejection, no historical backfill, retained deletion history); 78 installation checks across 38 candidates; five QA/production frontend notification tests; 1,546 retained frontend tests, zero skips; QA build, 511-file source parity and environment guard PASS. Access candidates 032/034/035 were deliberately excluded from this candidate's PostgreSQL scenario tests; they remain unapplied. Live installation, original status recheck, fresh creation/simulation check and fixture cleanup remain required.
