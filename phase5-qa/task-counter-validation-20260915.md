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

Deployment and repeated live counter/filter verification are pending. Production
has not been changed. Temporary task and notification cleanup remain tracked in
`qa-task-manager-ui-20260915.json` outside the repository.
