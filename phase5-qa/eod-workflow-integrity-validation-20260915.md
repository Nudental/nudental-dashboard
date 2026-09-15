# PH5-AUTH-006 — EOD approval and update integrity

The hosted ordinary office manager sees Access Restricted at /pending-approvals.
Direct authenticated QA writes nevertheless permitted self-approval, rejection,
edits to approved entries, forged approval metadata, and office retargeting.
Seven of thirteen live expectations failed. A separate creation probe also
persisted a preapproved staff entry. Every probe used a newly labeled temporary
QA record; every record was removed after readback, with audit events retained.

Root cause: overlapping UPDATE policies check activity and old-row ownership or
office access but do not enforce the UI's approval roles or protected workflow
fields. The earlier insert boundary controls identity/scope but not initial
approval state. The original schema and its permissive policies remain preserved.

005-eod-workflow-integrity.sql adds one BEFORE INSERT OR UPDATE guard on
daily_entries. Authenticated writes must retain active-profile and old/new office
access. The existing four approval roles remain authoritative: super_admin,
admin, regional_manager, regional_clinical_manager. Other actors cannot create
preapproved entries, change status/approval metadata, or edit approved/post-
approval entries. Ordinary pending-entry notes still work. The empty default
rejection reason is preserved. Existing trusted service imports/QA fixture setup
remain available; no API route or user permission is widened.

Verification:

- Local original-schema negative control reproduced ten failing expectations.
- 27/27 local tests PASS after the candidate, including approve/reject/reapproval
  edits for all four approver roles, ordinary pending writes, and audit actors.
- Applied only to hvtxjfayenqnwtaisoaw through its existing SQL editor. An extra
  deployment precheck verified the specific completed QA schema installation.
- Catalog confirms one enabled trg_dashboard_eod_workflow_guard; the existing
  analytics trigger remains disabled. Production policies are unchanged.
- 14/14 live Auth/PostgREST checks PASS, including the separately reproduced
  preapproved creation bypass. Allowed writes persist and have one matching audit;
  denied writes do not persist or create a false update audit. All fixtures cleaned.
- Normal office-manager browser submission reports success; refresh/readback,
  notes editing, audit actor/old/new values, denied deletion, and cleanup: 7/7 PASS.
  Browser fixture 9904ecdf-bebe-4010-8a4d-9a12085e1e1d was deleted; three audit
  events retained. No external/provider workflow was executed.
- Post-change public API regression: 22/22 EOD access/readback checks and
  15/15 runtime/identity isolation checks PASS.

This completes this narrow integrity repair. Full approval UI execution/history
and other product API routes still require their remaining Phase 5 checks.
