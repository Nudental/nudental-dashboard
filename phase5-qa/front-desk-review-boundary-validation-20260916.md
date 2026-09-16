# Front Desk review authorization and atomic audit

PH5-AUTH-025 / PH5-AUDIT-013 — tested candidate, not yet applied or live verified.

The user chose Regional Manager/Admin approval only, with no self-approval. A live QA transaction used the existing Office Manager identity and its labeled Submitted request to reproduce successful self-approval, then rolled back. The original Submitted status and null reviewer remained. Saved proof `36725ec0-2c92-43b1-aa52-ccb58c9a71b5`; no lasting record or notification change.

Root causes: the Front Desk component includes Office Manager and Regional Clinical Manager in its general `isAdmin` review check; the batch write policy also allows request owners to update any status. Review data and audit insertion currently use separate writes, so a failed audit can leave a saved decision.

Candidate 040 is isolated QA only. Its trigger requires an active Regional Manager, Admin or Super Admin who is not the requester; enforces the signed-in reviewer and rejection reason; rejects stale review transitions and owner/category changes that would bypass the rule; and records review changes atomically. An additional Front Desk update policy enables the actual Regional Manager role while the existing restrictive active-account/page/office policy remains mandatory. No page, office or role assignments change. Existing receipt fulfillment and Clinical requests retain their current behavior.

The QA UI uses the same reviewer/no-self rule for list labels, detail actions and handler. Production keeps its existing behavior. The service returns after a QA Front Desk review update because the database now records its audit in the same transaction; other environments and Clinical requests retain their original audit path.

Verification: 39 offline PostgreSQL checks pass, including the original bypass, all thirteen identities, self-review by Super Admin, requester/category/reviewer spoof attempts, invalid transitions, no-reason rejection, authorized Regional Manager/Admin decisions, repeat/no-op, audit-failure rollback, missing page permission, unchanged Clinical/fulfillment paths and retained cleanup history. Offline role/page variants exercise allowed reviewers; hosted fixture permissions are unchanged. Fifteen frontend tests and all 1,561 retained frontend tests pass with zero skips. All 82 installation checks across 40 candidates pass; QA build and artifact checks are recorded separately. Live installation, deployment, owner denial, authorized review, refresh, replay and cleanup remain required.
