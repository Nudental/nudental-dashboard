# Front Desk catalog audit history

PH5-AUDIT-009 — PASS in isolated QA, September 16, 2026.

Creation and quantity editing both persisted without audit history. The copied
catalog table had only its quantity/status trigger and no audit trigger.
Migration 033 adds a private, actor-bound AFTER trigger that writes the existing
audit_logs table atomically. It preserves old/new snapshots and changed fields,
skips timestamp-only or unchanged updates, and retains deletion history. It does
not manufacture history for earlier operations or change audit read permissions.

Twenty-two actual PostgreSQL checks pass, including original missing history,
create/edit/delete snapshots, actor attribution, invalid-write rollback,
duplicate replay and preservation of unrelated rows and existing audit policies.
All 68 candidate installation checks pass. This audit migration was also tested
without the separate, unapplied migration 032 access boundary.

Source 1ae4112 is pushed. Applied SQL receipt
5e88f327-6b9d-4e8d-b429-9bef0833353d is saved and closed. No frontend or
production deployment was performed for this database-only repair.

Live Office Manager create reports success and records one INSERT audit. Manual
quantity edit from zero to two reports success and records one UPDATE with the
same authenticated actor and correct before/after values. Full page refresh
shows two units / Critically Low. An identical update leaves the business values
and two audit rows unchanged; the existing status trigger advances updated_at.

Exact-ID/name/office cleanup removes only QA TEMP PH5-CATALOG-AUDIT-20260916,
retaining its third DELETE audit. A repeated deletion is a no-op. Live UI reload
confirms removal. The older five-unit catalog fixture remains for the pending
access-boundary check, and its missing historical events are not backfilled.

Applied QA migrations are 001–031 plus 033. Migration 032 remains UNAPPLIED,
pending explicit approval after automatic approval review rejected execution.
