# Front Desk review authorization and atomic audit

PH5-AUTH-025 / PH5-AUDIT-013 — applied and live verified in isolated QA.

The user chose Regional Manager/Admin approval only, with no self-approval. A live QA transaction used the existing Office Manager identity and its labeled Submitted request to reproduce successful self-approval, then rolled back. The original Submitted status and null reviewer remained. Saved proof `36725ec0-2c92-43b1-aa52-ccb58c9a71b5`; no lasting record or notification change.

Root causes: the Front Desk component includes Office Manager and Regional Clinical Manager in its general `isAdmin` review check; the batch write policy also allows request owners to update any status. Review data and audit insertion currently use separate writes, so a failed audit can leave a saved decision.

Candidate 040 is isolated QA only. Its trigger requires an active Regional Manager, Admin or Super Admin who is not the requester; enforces the signed-in reviewer and rejection reason; rejects stale review transitions and owner/category changes that would bypass the rule; and records review changes atomically. An additional Front Desk update policy enables the actual Regional Manager role while the existing restrictive active-account/page/office policy remains mandatory. No page, office or role assignments change. Existing receipt fulfillment and Clinical requests retain their current behavior.

The QA UI uses the same reviewer/no-self rule for list labels, detail actions and handler. Production keeps its existing behavior. The service returns after a QA Front Desk review update because the database now records its audit in the same transaction; other environments and Clinical requests retain their original audit path.

Verification: 39 offline PostgreSQL checks pass, including the original bypass, all thirteen identities, self-review by Super Admin, requester/category/reviewer spoof attempts, invalid transitions, no-reason rejection, authorized Regional Manager/Admin decisions, repeat/no-op, audit-failure rollback, missing page permission, unchanged Clinical/fulfillment paths and retained cleanup history. Offline role/page variants exercise allowed reviewers; hosted fixture permissions are unchanged. Fifteen frontend tests and all 1,561 retained frontend tests pass with zero skips. All 82 installation checks across 40 candidates pass; QA build, 511-file source parity and 17 hosted isolation checks pass.

Migration 040 is applied only to `hvtxjfayenqnwtaisoaw`, saved receipt `c4d52ff2-934d-4730-8848-0f4ca7e0960e`. QA deployment `9fb1f39e-ce99-4791-969a-d552e792825f` uses source `39d89493bd7221c529a67f61702e06ef18995e20`, entry `assets/index-gxu699wM.js`, 8,833,075 bytes, SHA-256 `cfb9bd0086189fc7bb036b192f35b3b79941c2bd2223b06d8cda03be0966849a`. Rollback `80c69cdc-8ebb-4f18-aece-d25364965521` is preserved; production/main/API are unchanged.

Live verification:

- Twelve negative API attempts (the eleven non-Super fixture identities plus anonymous) cannot approve the exact pending request. The Office Manager owner receives a permission error; complete request/line/audit snapshots stay unchanged. Existing page/office permissions are not expanded for these tests.
- Normal Office Manager UI sign-in shows View instead of Review on its own Submitted request. After the detail screen finishes loading, Approve, Mark Under Review and Reject are all absent.
- A different QA Super Admin sees Review, marks Under Review, then Approves. Each UI action reports success and adds exactly one audit with the correct actor and before/after values. Four events total include the original draft and submission.
- Full refresh shows Approved/View, zero Review buttons and no pending-review counter. Repeating the same decision leaves the entire record and audit state unchanged; a stale Under Review attempt receives `22023` and changes nothing.
- A second labeled October request is created/submitted through the existing QA draft/submission RPCs as the Office Manager. Super Admin rejection without a reason displays the expected error and leaves the Submitted request/two audits unchanged. A supplied test reason produces Request rejected and one correct rejection audit. Full refresh shows Rejected/View and no pending counter.
- Both exact requests and their lines are cleaned up; the four approval-case and three rejection-case audit events remain. Repeated deletion returns zero without audit changes. Refreshed live review queue shows No Front Desk requests found.

Evidence: `qa-frontdesk-review-20260916.json`, `qa-frontdesk-rejection-20260916.json`, updated `qa-frontdesk-ui-20260916.json`. Do not rerun fixture helpers after cleanup. No real order, external message, provider call, password change or production mutation occurred. Positive Regional Manager/Admin decisions are covered by offline permission variants; the live positive reviewer was the existing QA Super Admin.
