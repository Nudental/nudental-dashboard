# Mobile urgent-request item selection

PH5-SUPPLY-019 — reproduced twice live, repaired and verified in isolated QA.

At the compact browser width, New Urgent Request opened the mobile wizard with a blank item (displayed as a dash) and no item text field or selector. Both openings had zero textboxes and were cancelled without submitting. The wizard is designed to receive an existing inventory item, but the generic New button explicitly passed a null prefill.

The button now opens the existing responsive request form, which supports catalog search and custom item selection, on both mobile and desktop. Opening an urgent request from an existing inventory item still uses the prefilled mobile wizard. This is one event-handler change; no submit handler, data schema, permission or notification configuration changes.

Four focused handler checks: baseline three pass/one fail, candidate all four pass. All 1,532 retained frontend tests pass, zero skips. QA build, 511-file source parity, artifact isolation and 17 hosted checks pass.

QA deployment `14401159-5b87-4427-abd3-b8e73fad57a0`, source `aba10b1f2cd5e987291b8bb0325c8f233fb9e690`, entry `assets/index-BNpDrrh4.js` (SHA-256 `deea4e95bce5ddfb6c3491f23357cc578484cdf0d46e08ba1b12a07e2cf97f11`). Prior QA deployment `19f89e5b-d026-48d0-b6b2-3f6f4e3d62d3` remains available for rollback; production unchanged.

Live original test PASS after full refresh: the compact browser New Urgent Request button displayed catalog search and custom-item entry. Searching the original labeled QA item returned the correct result; selection populated its item, department, subsection and unit. Cancel returned to the empty urgent-request list. Database readback confirmed zero urgent records; no test records required cleanup. The existing item picker reported on-hand zero before an office was selected; office-specific stock prefill remains a separate follow-up check. Urgent submission, notification mock and status workflows are not claimed as verified by this routing repair.

Notification safety inspection: the dedicated QA project `hvtxjfayenqnwtaisoaw` Edge Functions page showed “Deploy your first Edge Function”; no functions are deployed. The organization page temporarily failed its permission lookup, but a fresh direct QA project page loaded successfully. No provider function was deployed or invoked during this inspection. Production Executive Overview remained rendered with normal sections and no alert roles; no production writes performed.
