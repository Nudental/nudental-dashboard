# Front Desk catalog counters after writes

PH5-SUPPLY-009 — PASS in isolated QA, September 16, 2026.

The catalog row changed successfully from five/Low to six/In Stock, then
zero/Out of Stock, while summary cards stayed at one Low item and zero in the
other categories. Exact database readback confirmed both writes. The handlers
updated local rows but never refreshed the separately fetched summary.

Create, row edit and quantity edit now refresh the existing authoritative
summary after a successful write. The refresh preserves the open category and
does not remount the table. A summary-read failure reports that the item was
saved and the summary needs retry; it does not suggest the write failed.

Twelve actual-handler checks pass: authoritative counters, failed-write handling,
stable loading state and summary-read failure behavior. All 1,443 retained tests
pass with no skips; build, 510-file parity and 17 hosted checks pass.

Final source 4d185e2dd9063631c10d2b93b6d3a0b2e25ac0bd is pushed. QA deployment
5c99d0a5-108e-4a19-95ac-3c825ca82bf5 uses assets/index-BND2hW60.js,
8,829,827 bytes, SHA256
198c76990983939291aa6cb886eb6e851476b32a8a1df1a256dadeb2e67e06bb.
The initial candidate refreshed counters but collapsed the category; live
regression caught this and the final refinement is verified to keep it open.
Earlier QA releases b465289a and 0c221564 remain recoverable. Production remains
1f1f91bc; no production configuration or data changed.

Live quantity transitions six→zero→six now update counters immediately and
retain the visible row. Exact readback finds one record, six units and five
legitimate update audits. Edit-and-cancel preserves the complete row/audit
snapshot. A separate labeled zero-unit create reports success, produces one
creation audit and immediately adds one Critical/Out count. Full refresh keeps
the correct two-record counters. Its exact cleanup retains a second deletion
audit; the original six-unit fixture remains for pending access verification.

The row-edit branch passes focused tests; its broader optional-field UI workflow
is still pending and is not claimed covered by the quantity/create live checks.
