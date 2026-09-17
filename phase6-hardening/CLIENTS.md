# Phase 6 client candidate

Not deployed. Production depends on successful Group A and D installation before enabling these clients.

- Office assignments use the existing reviewed atomic RPC in both environments. Failure cannot fall back to delete/reinsert. Existing assignment audit remains.
- Supply drafts normalize optional identifiers and use one reviewed draft transaction. Receipts use one reviewed receipt transaction and require a confirmed success result; no partial-write fallback remains.
- Front Desk review follows the approved Regional Manager/Admin/Super Admin roles and forbids self-review in both environments. The client does not duplicate the database's authoritative review event.
- A dedicated `/front-desk-approvals` route requires both a reviewer role and the existing `workflow.approvals.view` grant. It mounts the existing review component without mounting the catalog or request-creation screen. MainLayout retains the active-account gate. No permission configuration is changed.

Validation: all 1,648 retained/new frontend tests pass with no failures or skips (the original 1,630 plus 18 route checks). Tests that intentionally preserved the pre-migration non-atomic production path now assert the released RPC contract, including denied writes and no fallback. Production and QA builds pass. Compiled request-isolation checks pass (6). Separate build keys, isolated QA connect policy and absent environment-file/source-map uploads are verified. The retained 17 backend suites and 13 materializer tests pass; no backend implementation is changed by this client candidate.

QA simulation switches and external-execution restrictions remain environment-specific. Production source, credentials, accounting records and provider connections are not replaced with QA fixtures.
