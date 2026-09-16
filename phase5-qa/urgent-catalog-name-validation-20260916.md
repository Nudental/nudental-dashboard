# Urgent request catalog item name

PH5-SUPPLY-023 — reproduced twice after refresh in isolated QA; candidate verification in progress.

The exact labeled request `QA TEMP PH5-URGENT-STOCK-20260916` retains its catalog item ID, quantity and creation audit, but the list shows a dash for Item. The list renderer already reads `supply_items.name`; `fetchUrgentRequests` omitted that relationship from its select expression. Add the existing `supply_items(name)` relationship to this read query only. No writes, schema, policies, notification delivery or configuration changes.

Four focused tests cover actual list rendering with the joined name, custom records without catalog items, unchanged office/status/priority filters, and propagated read failures. The name test fails before the fix and all four pass afterward. Full retained tests, build, deployment and live verification are recorded when complete.
