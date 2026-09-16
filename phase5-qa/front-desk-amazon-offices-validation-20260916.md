# Amazon history QA office filter

PH5-QA-SUPPLY-011 — PASS in isolated QA on September 16, 2026.

The office filter repeatedly offered only four production office names despite a persisted synthetic QA Office A history record. `FrontDeskAmazonOrderHistory.jsx` defined its own static office array. It now prepends All Offices to the existing environment-sensitive `frontDeskInventoryService.getOffices()` list. Production office names and ordering are unchanged.

The actual service/initializer tests changed from 8 pass / 1 fail to 9 pass. All 1,452 frontend regression tests pass, with no skips. QA build, 510-file source parity, secret/environment checks and 17 hosted checks pass.

Source: `601c70a830bfe61e9b4260062bc6a8fc94d0e6fb` (pushed).
QA deployment: `46e07c2d-fc18-4e17-8847-3c3cfec21a65`.
Entry: `assets/index-CYiRDHIl.js`, 8,829,822 bytes.
SHA256: `6ee6bb0f00eae9054300658dfb2cb56e5314ad3366b8710495ae98a1cdc7204c`.
Previous QA deployment `3db499b1` is preserved; production remains `1f1f91bc`.

Live full reload shows All Offices, QA / Office A and QA / Office B. Office A returns exactly the labeled synthetic order, September 16 date, September month, quantity two and zero spend. Office B returns zero rows, zero counts and disabled export. Exact order search, no-match search, requester filter and Clear Filters all pass. The existing QA banner remains visible.

The synthetic record remains tracked for the next reversible status tests and pending access migration 034; cleanup remains owed. No external provider operation or production change occurred. Access migrations 032 and 034 remain unapplied pending explicit approval and are not included in this live PASS.
