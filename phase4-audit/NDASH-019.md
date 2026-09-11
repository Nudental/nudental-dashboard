# NDASH-019 — Regional Manager item search never matched item names

- Reproduced twice: an item present in the expanded historical request produces no results in Search by item or office.
- Root cause: the local search checked only office and requester names, while the batch query fetched no related item names.
- Changed: `supplyRequestService.fetchRequestBatches` adds a nested read of catalog/custom item names; Regional Manager includes those names in trimmed, case-insensitive matching. Existing office/requester search is retained; missing relationships are safe; multiple matching items do not duplicate a parent request.
- Database relationship validated read-only before editing. No schema/policy, review/approval, notification, configuration, or business-data changes.
- Verification: 64 frontend tests PASS; production source build PASS (29.96s); six actual artifact search scenarios, syntax and exact reversal PASS.
- Candidate `index-b079c7096678.js`, SHA256 `b079c7096678ab8968860c347a69aadd9c0140a0657470fe3da765e7dd825063`; previous `ndash018-dist` preserved. Deployment/live verification pending.
