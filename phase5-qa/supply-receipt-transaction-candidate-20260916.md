# Transactional receipt validation

PH5-SUPPLY-017 — applied and live verified in isolated QA; production unchanged.

Two QA administrator tabs held the same pending two-unit receipt open. First submission completed the receipt and raised its linked synthetic stock from six to eight. Submitting the stale second form again reported success and raised stock to ten, even though qty_received remained two. Stock history grew from four to six events and receipt audit history from one to three. Evidence is retained in `qa-receipt-replay-20260916.json`.

The current service applies independent receipt, stock, history and request writes, using the full entered quantity each time. It does not lock/read the persisted receipt total, and ignores errors in later stock/history/request operations.

Candidate 037 adds a QA-only SECURITY INVOKER receipt transaction. It retains existing table policies, requires an active supply writer, locks each receipt, treats received quantity as its persisted cumulative total, and applies only the unapplied positive difference. Equal totals are successful no-ops; completed changes, reductions and cancelled receipts fail. Stored links, supplied counts and authenticated actor are authoritative. All linked changes/audits roll back together on failure. The QA service uses one RPC and never falls back to independent writes; production keeps its existing path.

Validation: 69 offline PostgreSQL checks (including all fixture-role denials, no policy changes, full/partial/multi-item replay, linked requests and rollback at history/audit/later-item failures); six routing checks; five retained receipt-error checks; 76 installation checks across 37 candidate migrations; 1,503 frontend regressions, zero skips; QA build, 510-file source parity and 17 hosted checks passed.

Migration 037 was applied only to project `hvtxjfayenqnwtaisoaw`, guarded by its schema installation identity. Saved SQL receipt: `16e22b74-a4db-4047-a079-28ccae971e0d`. The function remains SECURITY INVOKER and anonymous execution is revoked. Thirteen live identity/no-op checks passed without changing fixture state: the authorized QA Super Admin could repeat the completed total; the other eleven fixture accounts and anonymous client were denied.

QA frontend deployment `59f7e08c-9ad3-491f-8570-c8c01332db46`, source `2a7581676e93049b2a49439b636c4e7202bc8018`, entry `assets/index-DSMqsAV2.js` (SHA-256 `254d0d9ff7b2bb1ba6972bf1a988e1d5a8c6482fc982d63d6a6f37d08cd5ccee`). Prior QA release `12a045da-9299-4683-9e08-726268fd0563` remains recoverable.

Original two-tab live test PASS: the first form received two units and moved stock six to eight with one stock-history event and one receipt audit. The stale second form reported success as an idempotent repeat: the entire receipt, stock, timestamps and both histories remained exactly unchanged. Full refresh retained Completed/two received and eight units. This is a stale sequential submission test; simultaneous concurrent requests are not claimed as live-tested.

Cleanup PASS: restored the original synthetic stock to six through its normal UI (one -2 adjustment audit), then deleted only the exact labeled disposable receipt with ID, office and full-state guards. All nine stock-history events and six receipt audit events remain, including reproduction evidence. Repeated delete returned zero and added no audit. Refreshed UI showed no fulfillment records. The receipt evidence now records `cleanup_required: false`; the original stock hierarchy remains separately retained for pending access/retention checks.

Migrations 032, 034 and 035 remain unapplied pending their existing approval request. This transaction was tested independently of those candidates and does not apply them. Production, main, provider configurations and business records are unchanged. Linked creation-versus-receipt accounting and actual simultaneous clients remain to verify. Partial/multi-item/linked-request cases and failure rollbacks passed offline PostgreSQL tests, not positive live UI tests.
