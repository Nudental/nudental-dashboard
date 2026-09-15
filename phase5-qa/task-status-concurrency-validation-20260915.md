# PH5-TASK-001 — Duplicate task start from concurrent views

Two QA Staff Team Assignments views reviewed the same acknowledged temporary
task. Concurrent Start Task clicks both succeeded and wrote two task_started
audit entries. One task row remained, but the second request also overwrote the
first start timestamp. Evidence is preserved outside the repository in
qa-task-concurrent-start-original-20260915.json.

actionItemsService.updateActionItem filtered only by task ID and computed lifecycle
timestamps from the stale view. It now also requires the previously reviewed task
status when supplied. A stale write returns the existing single-row error before
semantic audit logging. Callers without a reviewed task retain their behavior.
No task fields, role rules, provider settings or production configuration changed.

Nine actual-service tests: five PASS/four FAIL before, nine PASS after. They cover
concurrent starts, stale states, all three ordinary transitions, permission denial
and the legacy caller. All 1218 retained frontend regression tests PASS, no skips.
QA build and all 510 copied source files match; environment and secret checks PASS.

Entry index-DXrLMxCM.js, 8,827,141 bytes, SHA256
5e846f33d8932e723341961840cf8d9a9e4f655ca0bf220d3c4d0ca250701687.
Archive SHA256 0bad3ec7d5dcb9767d47431b572b2f203c6c7f8bbb3a0e9bd6409fae7a7b3949.
QA deployment 9401630f-a618-4753-a487-59ae92e4b2ad from
cc0e68f3683c768601be7f1287d7f86e064192cf succeeded. All 17 hosted checks PASS.

An initial refresh retained the previous index-IbeDC0R9.js script in both browser
tabs; its duplicate result was preserved and that disposable task cleaned. Loading
the release query URL made both tabs visibly use index-DXrLMxCM.js before retry.
The repeated concurrent start then produced one successful transition, one stale
view error, and exactly one task_started history entry with the QA Staff actor.
The prior acknowledgement timestamp remained intact. Refresh showed the saved
In Progress state; ordinary table completion produced one task_completed entry,
correct actor/timestamps and Completed 1 after refresh. The separate disposable
task was removed after verification with its audit history preserved.

The original Huddle-linked task remains tracked for other workflow tests. The QA
staff task-page permission is still temporarily enabled and must be restored to
its original false value after these bounded tests. Production remains unchanged.
