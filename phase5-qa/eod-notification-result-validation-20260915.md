# PH5-EOD-012 — rejection claims notification despite request failure

Normal rejection in hosted QA saved correctly and displayed “Office Manager has
been notified,” while the same page logged the notification request's Failed to
fetch error. The request targets the isolated QA project and reserved synthetic
address only; no production provider or operational mailbox was used.

Root cause: sendRejectionEmail swallowed failures, ignored HTTP/application
responses and returned no outcome. handleReject unconditionally claimed delivery.
The existing edge-function source returns success=true and a provider message ID
after provider acceptance; it returns HTTP500 on errors. Acceptance is not proof
of recipient delivery.

The helper now returns true only for HTTP success plus that acknowledgment.
Missing recipient, lookup/network/HTTP failures and invalid/negative responses
return false. Both existing rejection actions retain the saved status and report
either request accepted or notification unconfirmed. No adapter, credential,
recipient, deployment configuration or provider behavior changed.

Fourteen mock-only regression tests: zero PASS before, fourteen PASS afterward.
Full tests/build and QA live feedback verification pending.

All 1155 retained frontend/production-parity checks PASS, no skips. QA build and
source/environment verification PASS. Entry index-vF3R0tEN.js, 8,825,533 bytes,
SHA256 58937994bb9003439ecceabaad9a84b220ee7c3b39adaaf20083f26254b0d1c9.
Archive SHA256 4a9986271a3a65c17389abe16644e9f7bb8b00b6113c2d164cebe39b9debfde2.

QA deployment 26d3d95b-aa3c-4f6b-adb7-59b356b8eee1 from 19a9e88cca succeeded.
All 17 hosted entry/environment checks passed and production remained unchanged.
Live normal rejection and approval reversal both displayed their saved outcome
plus “Notification could not be confirmed.” Exact reasons/statuses/history and
counters persisted in QA. Positive provider acceptance is verified by mocks only;
no real provider delivery was attempted. The synthetic pair remains briefly for
the subsequent reversal-concurrency test. Both are now cleaned, baseline counts
restored, and their three/four row-audit events retained respectively.
