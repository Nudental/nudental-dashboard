# PH5-TASK-002 — Refresh counts and filters after task saves

Reproduced in isolated QA using `QA TEMP PH5-TASK-MANAGER-UI 20260915`.
After Acknowledge → Start Task, the board showed one In Progress card while the
summary remained zero. After Mark Complete, the board showed two completed cards
while the summary and Completed filter badge remained one. Refresh corrected the
count to two. Reopening again left the badge at two while the board showed one.
Independent database readback confirmed each saved status and actor.

The status and edit handlers in `team-assignments/index.jsx` updated only the local
task array. Counts and filtered membership depended on a later realtime event.
Both successful handlers now await the existing role-scoped `loadTasks()` query,
as the creation handler already does. No authorization, schema, task fields,
production configuration or provider behavior changes.

Nine tests execute the actual handlers and loading query without a realtime
event. The original code passes two denial cases and fails seven counter/filter
cases. Coverage includes start, complete, reopen, completed-filter removal,
edit-modal status change, reassignment out of My Tasks, and ordinary assignee use.

Before repair deployment, manager UI validation passed required fields, create,
refresh persistence, cancel, priority/date/note edits, acknowledge/start/complete,
and reopen preserving lifecycle history. Exactly one task and one assignment
notification were created. Each successful write has one database row audit and
one semantic task audit. Native keyboard entry works for the date field; the
browser automation fill shortcut did not notify React and is not an app defect.

All 1,247 retained frontend tests pass with zero skips, including the nine new
counter/filter cases. All 510 copied build source files match the candidate.

QA deployment `ab3fe6f4-ffe3-4eb2-91a9-d5868d9df226` succeeded from source
`3fd001ee109efd76120790afd02e20f9a1fd3f91`. The browser confirmed entry
`index-CbNeYcha.js`, SHA256
`428ba057a24967bdeaeeca92943a09cbaec1471ef15d33270da2940c75967acf`.
All 17 hosted artifact, isolation, API-boundary and unchanged-production checks
pass. Previous QA release `c5f7596c-0d48-4b06-a880-c8d5837b896b` is preserved.

Live PASS without page refresh: start shows summary/board In Progress 1; completion
shows Completed 2; reopening from the Completed filter removes the reopened card
and reduces the badge to 1. Edit-form completion and reassignment to the existing
QA Staff actor updates Completed to 2 and My Tasks to 0 with no remaining cards.
Restoring the original assignment/status succeeds. Independent readback verifies
each change, exact actor, one row audit plus one semantic audit per successful
operation, and unchanged original lifecycle timestamps. The task and its sole
assignment notification were removed; all 25 task audit entries remain.
Evidence: `qa-task-manager-ui-20260915.json` and
`qa-task-counter-repaired-20260915.json` outside the repository.

Production deployment remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.
