# PH5-AUDIT-005 — Implant lookup writes missing from audit history

The labeled QA company created through the UI persisted without a general audit
event. The same ordinary-admin create/deactivate/restore operations were repeated
against all five lookup tables: companies, systems, platform sizes, lengths and
diameters. Every write persisted, ordinary staff updates were rejected, but all
audit trails were empty. All five disposable API probes were cleaned up.

The existing services issue direct table writes, and the recovered schema attaches
no audit trigger to these tables. Migration 015 attaches the existing
`fn_audit_trigger()` to their INSERT/UPDATE/DELETE events. It changes no business
rows, policies, roles, credentials, or audit-function behavior. The migration
rejects non-QA installation and preserves the earlier 14 QA repairs.

Verification: 30 offline PostgreSQL behavior checks and all 32 installation and
coexistence checks pass. The migration was applied to the existing isolated
Dashboard QA project only; all five triggers are enabled. Saved snippet:
`388646f6-f751-40a6-be19-ac9795686122`.

All 40 live QA checks pass: admin create/readback, deactivate/restore, audit actors
and before/after values, staff write denial, no duplicate audit on denied writes,
and cleanup with retained deletion audits. The original UI company deactivation
then persisted across refresh, and restoring it returned the active count to 1.
Each toggle created one audit event by the existing QA Super Admin. Its original
pre-fix creation was not backfilled or represented as audited.

Evidence: `qa-implant-lookup-audit-original-20260915.json`,
`qa-implant-lookup-audit-repaired-20260915.json`, and UI stages in
`qa-implant-ui-20260915.json`. API probes are fully cleaned; the original labeled
company remains for inventory testing. All 17 hosted environment checks pass.
Production remains unchanged. No frontend deployment was needed for this fix.

Rollback, if needed: remove only these five newly named triggers in QA; retained
audit records and all earlier triggers remain. The pre-change branch state is
recoverable at `9960555`, and the repair source was preserved at `aeb8a1d`.
