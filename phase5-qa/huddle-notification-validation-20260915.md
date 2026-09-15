# PH5-HUDDLE-003 — rejection claims email delivery after request failure

Reproduced twice in hosted QA during the preceding rejection tests: success
claimed the submitter had been notified while the browser logged the helper's
Failed to fetch warning. The rejection persisted, but delivery was unconfirmed.
The confirmation dialog also promised notification before making a request.

Root cause: sendDRRejectionEmail ignored HTTP/JSON outcome, swallowed errors and
returned no result. handleDRReject unconditionally claimed delivery. The helper
now returns true only for an OK response with success:true and a nonempty message
ID matching the existing edge-function contract. Otherwise it returns false.
The toast distinguishes saved rejection from accepted/unconfirmed notification;
the dialog describes requesting notification without guaranteeing delivery.

Existing provider, request payload, credentials, recipient selection and workflow
remain unchanged. This does not prove recipient receipt; even the positive
response is described only as request acceptance. No production provider call.
Twelve actual-helper/handler offline cases all failed before repair. Full tests,
QA publication and live failure-feedback verification pending.

All 12 focused cases now PASS; all 1199 retained frontend/production-parity tests
PASS with no skips. QA build, source match and environment checks PASS.
Entry index-QMPe93jL.js, 8,826,544 bytes, SHA256
9653597cdb6b2c64f9422bdf0344eb9ddb8fe5dd0b9ee929380fcd01ec6f09d8.
Archive SHA256 a6712cd45df8a63abed8b5b78f0543097cf60c1aa25a50ce47bb792e2743183c.

QA deployment 0daa0bdc-23ee-4bf5-af24-b6200901ed90 from
c85ecf4786047a62948b699f80471149a7656415 succeeded; 17/17 hosted checks PASS.
Live dialog now describes requesting notification without guaranteeing delivery.
Normal temporary A rejection displayed: Daily Report rejected. Notification could
not be confirmed. Persisted reason/history/audit and refresh counters PASS
(Pending 2, Rejected 1, Daily Reviews 2). No duplicate record/history was created.
Both temporary fixtures cleaned; baseline counts restored, three/two row-audit
events retained. Positive provider acceptance tested offline with a mock only;
QA has no operational notification provider. No external mail or production write.
