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
QA publication and live verification pending. A separate labeled temporary task
is tracked by verify_task_status_concurrency.py for start, completion and cleanup.
Production remains unchanged.
