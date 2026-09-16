# Front Desk order status audit

PH5-AUDIT-010 — PASS in isolated QA, September 16, 2026.

Closing the labeled synthetic order saved Closed but failed the audit insert twice with a missing `metadata` column error. Both readbacks showed zero audit entries. The current `supply_audit_logs` schema has record ID/type, action, actor, time and old/new values; the handler also sent a nonexistent metadata column.

The targeted fix removes only that unsupported metadata property from `FrontDeskAmazonOrderHistory.jsx`. The existing status-only update, actor/timestamp, before/after audit values and explicit audit-failure warning remain. No schema, permissions, credentials, provider or production configuration changed.

Six actual-handler tests use the exported schema's audit columns: baseline 4 pass / 2 fail, repaired 6 pass. Single and bulk audit payloads, update denial, audit-error reporting, empty/cancelled selection and preservation of quantity/receiving fields pass. All 1,458 retained frontend tests pass without skips. QA build, 510-file parity and 17 hosted isolation checks pass.

Source `ec26474557204a6cafba9ef58191ac787441f310` is pushed.
QA deployment `fda8a0f8-b2fb-4ed1-a0b4-975ccc87d937` uses
`assets/index-9yeXxRwJ.js`, 8,829,568 bytes, SHA256
`c773fab41aae635c4b00cefba179e284cad38e452faf7a824f8a203328e171f1`.
Rollback `46e07c2d` is preserved; production remains `1f1f91bc`.

Live Cancel left the exact Pending record and zero audits unchanged. After repair, the original UI close reports “1 order marked Closed. Audit log written.” Readback confirms one record, one Pending-to-Closed audit attributed to the QA Office Manager, unchanged quantity two, zero amount and Not Received. Full refresh retains Closed, shows no repeat close button and leaves exactly one audit. No Amazon/provider connection or purchase occurred.

Live multirow/concurrent replay coverage is not claimed by this single-row check. The record is retained for pending access candidate 034 and later exact-ID cleanup. Candidates 032 and 034 remain unapplied; their live permission verification is still pending explicit approval.
