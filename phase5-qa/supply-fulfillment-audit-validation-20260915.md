# Fulfillment audit lifecycle

PH5-AUDIT-008 — PASS in isolated QA, September 15, 2026.

Two readbacks of the browser-created fulfillment showed zero audit entries. The
existing service inserts the business row without audit recording, and the table
had no audit trigger. Migration 029 adds a private, fixed-search-path trigger
that writes actor-bound insert/update/delete snapshots in the same transaction.
Unchanged updates produce no extra event. Audit reads follow the active account,
existing Clinical Supply permission and office scope; snapshots preserve this
boundary after the business record is deleted. Direct client inserts of this
audit type are rejected. No historical create events are invented.

40 actual PostgreSQL tests pass: lifecycle, rollback when audit insertion fails,
no-op retries, denied forged entries, role/office scope and retained deletion
history. All 60 installation checks for 29 migrations pass. Pushed source
`0e7c8a6310aff0a7eae06eff77e42acf054348f2`; saved QA SQL receipt
`a4c24974-e451-4f16-b6ce-33e34c5ce4f6`. Trigger confirmed enabled.

Live browser create reported success and persisted one new labeled record with
one insert audit. An authorized QA API note edit persisted with a second event;
an identical retry left two events. Full page refresh showed the one new record
alongside the earlier save fixture. Twelve-identity reads confirmed that only
Super Admin and the currently permitted Office A manager see the record/history.
The UI does not expose note editing here; the edit check exercised its existing
database API rather than claiming a nonexistent UI control.

Exact-ID/label/office cleanup removed the new audit fixture, retaining its three
events. Repeated role reads confirmed deleted history is still restricted. The
earlier pre-trigger save fixture was also removed, retaining its deletion event;
no missing historical create event was backfilled. Browser refresh reports zero
fulfillment records. No linked stock or request item was modified.

Production, main, QA API and QA frontend remain unchanged by this database repair.
The original approved Clinical Supply request/item remains for workflow testing.
Other fulfillment form, import and linked-inventory paths are not claimed PASS.
