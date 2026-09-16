# Mobile urgent-request item selection

PH5-SUPPLY-019 — reproduced twice live; candidate awaiting QA publication/retest.

At the compact browser width, New Urgent Request opened the mobile wizard with a blank item (displayed as a dash) and no item text field or selector. Both openings had zero textboxes and were cancelled without submitting. The wizard is designed to receive an existing inventory item, but the generic New button explicitly passed a null prefill.

The button now opens the existing responsive request form, which supports catalog search and custom item selection, on both mobile and desktop. Opening an urgent request from an existing inventory item still uses the prefilled mobile wizard. This is one event-handler change; no submit handler, data schema, permission or notification configuration changes.

Four focused handler checks: baseline three pass/one fail, candidate all four pass. All 1,532 retained frontend tests pass, zero skips. QA build, 511-file source parity and artifact isolation checks pass. Live retest is still required. Separate urgent submission, notification mock and status workflows are not claimed as verified by this routing repair.

Notification safety inspection: the dedicated QA project `hvtxjfayenqnwtaisoaw` Edge Functions page showed “Deploy your first Edge Function”; no functions are deployed. The organization page temporarily failed its permission lookup, but a fresh direct QA project page loaded successfully. No provider function was deployed or invoked during this inspection. Production Executive Overview remained rendered with normal sections and no alert roles; no production writes performed.
