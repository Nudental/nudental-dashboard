# Initial clinical stock history

PH5-AUDIT-011 — PASS in isolated QA on September 16, 2026.

Two independent UI-created synthetic stock records had no initial history. The service inserted inventory directly, and the existing database trigger only calculated stock status. Subsequent manual adjustments had history, so the repair targets creation only.

Migration 036 adds a private fixed-search-path AFTER INSERT trigger. It records initial quantity from zero, the authenticated actor, timestamp and the explicit reason Initial stock record in the existing history table. Inventory creation and its history commit or roll back together. Existing rows are not backfilled; adjustment logging, access policies and foreign keys are unchanged.

20 actual PostgreSQL checks pass, including the original missing events, correct actor/quantities, zero-unit creation, no duplicate adjustment event, rejection/rollback when history fails, and unchanged policies. Installation verification passes 74 checks across 36 candidates. This does not imply that all 36 candidates are live.

Source `84f615609248a0fb7573b94dd1160ae0be7b0a22` is pushed. Migration 036 was applied only to isolated project `hvtxjfayenqnwtaisoaw`; the enabled trigger was verified and its query saved at SQL receipt `a294d84b-37fc-4d71-99df-62c2ee40ca71`. Save completion was confirmed and the SQL tab closed. QA frontend remains `e841805a`; production is unchanged.

Live UI creation of `QA TEMP Clinical Audit Check 20260916` saved one two-unit stock row and exactly one history entry (0 to 2, delta 2), attributed to QA Office Manager. Full refresh preserves one row/one event. The application history panel visibly displays +2 units (0 → 2), adjustment · Initial stock record, QA / Office Manager and the current date. The panel was closed afterward.

The new fixture is tracked in `qa-clinical-stock-create-audit-20260916.json` for eventual cleanup. The existing history foreign key cascades on parent deletion; stock cleanup must preserve these verified historical events. Retention and pending stock/history access candidate 035 are separate work. Applied repairs are 001–031, 033 and 036; 032/034/035 remain unapplied awaiting the user's access-control approval.
