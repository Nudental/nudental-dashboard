# Urgent request audit and QA notification simulation

PH5-AUDIT-012 / PH5-QA-SUPPLY-021 — applied and live verified in isolated QA.

Follow-up: access repairs 032/034/035/039 have since been explicitly approved,
applied and [live verified](access-restrictions-live-20260916.md). The final urgent
simulation fixture is cleaned; four audit entries and both mock intents remain.
The historical sequence and initial candidate independence below are preserved.

The labeled QA urgent request saved and acknowledged successfully, but both readbacks showed zero audit events. The UI also claims the regional manager was notified even though this isolated project has no deployed Edge Functions. Source confirms independent writes with no audit trigger and fire-and-forget requests to the old notification functions.

Repair 038 adds transactional create/change/delete history for urgent requests and two private, mock-only notification intents on creation. A failed audit or intent rolls back the request. Timestamp-only updates and repeat deletes add no audit. Existing histories are preserved; past missing events are not manufactured. The trigger cannot be called directly by anonymous/authenticated clients. New audit entries use existing active-account, monthly-supply page and office checks; direct client inserts of this audit class are refused. Existing request-table policies remain unchanged; their separately reproduced office/account access gap is tracked by unapplied candidate 039. Other audit classes and pending access candidates 032/034/035 are unchanged.

The QA frontend returns after the successful insert transaction instead of invoking email/SMS functions, and explicitly describes simulations with no email/SMS sent. Production keeps its existing provider calls and wording. No provider credentials, policies on request records, billing or production configuration change.

Validation: 47 offline PostgreSQL cases (audit/intent rollback, all 12 identity history scopes, forgery rejection, no historical backfill, retained deletion history); 78 installation checks across the initial 38 candidates; five QA/production frontend notification tests; 1,546 retained frontend tests, zero skips; QA build, 511-file source parity and 17 hosted deployment/environment checks PASS. Access candidates 032/034/035 were deliberately excluded from this candidate's PostgreSQL scenario tests; they remain unapplied.

Applied only to project `hvtxjfayenqnwtaisoaw`, guarded by schema installation batch 26. Saved migration receipt `f6f49eee-f8d6-41eb-b6d0-e32af8ce14d2`. QA frontend release `80c69cdc-8ebb-4f18-aece-d25364965521`, source `847c1c6cbe01640753fa741c957215b8860ca710`, entry `assets/index-Bh18LQ9b.js`, SHA-256 `10383d17bb708262f69471daafca94b732a9d59e872a0b86a4ce312eaacdebf5`. Prior QA `0abbfd1e-34dc-4e04-a2ae-10dd7537bb5d` remains recoverable. Production, main and API unchanged.

Live results:

- The original pre-repair acknowledged request moved through Process and Fulfill with two correct actor/before/after audit entries; refresh retained Fulfilled. Earlier missing events were not backfilled. Exact-record cleanup removed it, preserved three total audit entries, and a repeat delete returned zero without another event.
- A fresh labeled simulation request submitted successfully with explicit UI confirmation that QA notifications were simulated and no email/SMS was sent. Exactly one inserted request and one insertion audit carried `notification_mode=simulated`.
- Acknowledge then Deny persisted the correct states and brought this request to three audit entries. Full refresh retained Denied, removed the unacknowledged indicator, and exposed no further row actions.
- Repeating the same terminal status through the authenticated API preserved all business values and audit counts for both test records. An existing timestamp trigger may change only `updated_at`.
- A bounded private read before and after status/no-op checks returned exactly one `supply_email_qa` and one `supply_sms_qa` `notification.simulate` intent, both mocked. No external notification was attempted. Saved read receipt `3737854c-b546-4440-bbcd-8e747e73d321`.
- Thirteen live identities confirmed the new audit read boundary: Super Admin and Office A manager see this history; all other fixture identities and anonymous do not. The separate business-record read boundary failed and is covered by candidate 039, not counted as a pass here.

Evidence: `qa-urgent-request-20260916.json` (cleaned), `qa-urgent-simulation-20260916.json` (one denied record retained for pending access verification), `qa-urgent-roles-before-20260916.json`. Final simulation-record cleanup remains owed; its audit and two mock intents must be retained. This repair does not claim the entire urgent authorization workflow is complete.
