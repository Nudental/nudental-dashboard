# Group D — supplies, Front Desk and urgent requests

Candidate only; not deployed. Adapted from 025, 026, 028, 029, 032–037, 039, 040 and the independent audit portion of 038. Synthetic office changes, execution intents and notification simulations are excluded.

Production directory labels differ from stored supply labels. Four explicit aliases map “Nu Dental of Eatontown/Brick/Barnegat/Staten Island” to the existing directory names only for authorization lookups. No record labels are rewritten. Other labels remain unchanged and require an existing matching office.

Existing request/page/office grants remain authoritative. Front Desk reviewer roles are Regional Manager, Admin and Super Admin; none can self-approve. A reviewer page grant gives no catalog access or request-creation privilege. A direct QA probe reproduced an additional gap in the candidate reviewer UPDATE policy: a review-only actor could edit request contents without changing review state. The targeted guard now blocks request edits and fulfillment for review-only actors while preserving the existing page-plus-request editing permission. A second negative check confirms no fulfillment privilege is gained after approval.

Verification: 15 hosted QA checks using actual production permission configuration; retained draft/receipt/catalog/fulfillment/access/audit suites passed, plus 81 urgent-access checks; all-group idempotence/rollback/owners/grants passed. The revised native production preflight passed exact rollback and preserved 5,678 rows. It affects eight functions, 18 policies and five triggers, with unchanged table ownership/grants/RLS settings. No persistent production or hosted QA changes have been applied.

Atomic draft/receipt client activation requires this group to be installed first. Historical completed receipts with unknown quantities remain untouched. Existing specialized supply audit records retain actor, action, office in snapshots, before/after and time; the table lacks an immutable actor-role column. No competing logger or historical backfill is added.
