# Urgent request catalog item name

PH5-SUPPLY-023 — deployed and live verified in isolated QA.

The exact labeled request `QA TEMP PH5-URGENT-STOCK-20260916` retains its catalog item ID, quantity and creation audit, but the list shows a dash for Item. The list renderer already reads `supply_items.name`; `fetchUrgentRequests` omitted that relationship from its select expression. Add the existing `supply_items(name)` relationship to this read query only. No writes, schema, policies, notification delivery or configuration changes.

Four focused tests cover actual list rendering with the joined name, custom records without catalog items, unchanged office/status/priority filters, and propagated read failures. The name test fails before the fix and all four pass afterward. All 1,584 retained frontend tests pass, zero skips; QA build, 511 source-file comparisons and 17 hosted isolation checks pass.

Source `660aaa3a1ab8ff7df02606a5711a626bde45229e` deployed as QA `f2983c78-166c-4359-b0ea-4d9113ec0451`, entry `assets/index-DX_7R3Os.js`, SHA-256 `3e06d65ad506f7852365048aa79e31ee6cd028d938252f547b9da90d63aba891`. Full reload shows the correct catalog item name on the same request. Office B shows no requests; returning to Office A shows the correct item. No request or audit duplicates were created. Cleanup removes the exact test request, keeps two creation/deletion audit events, and repeat deletion affects zero records. Stock remains six; a further full UI reload shows No urgent requests and no request-count badge. Five earlier synthetic Huddle notifications were marked read through the UI, retaining their history; the unread badge stays absent after refresh.

Production remains deployment `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`; no production release or business-data write. The previous QA release `a00da932-5961-498b-86a5-d9382a294be7` remains recoverable.
