# PH5-HUDDLE-006 — Task Created marker disappears after refresh

Ordinary office-manager QA conversion created exactly one labeled task assigned
to QA Staff, with task_created audit history. Cancel previously created no task.
The checklist displayed Task Created, but a refresh reverted it to Task despite
the task persisting. The marker existed only in ChecklistSection's local Set.

getHuddleById now requests only checklist IDs from tasks linked to the selected
Huddle, under existing row policies, and annotates its checklist readback. The
component honors that persisted marker along with newly created local markers.
Task creation, assignment, notification configuration and permissions remain
unchanged. The existing ability to create further tasks from the same item stays;
this does not impose a new one-task-per-item business rule.

Three scoped actual-service cases: one PASS/two FAIL before. No task metadata is
requested when the Huddle is denied. Only checklist IDs are selected and the query
is scoped to that Huddle. Publication and live readback verification pending.

All three scoped tests now PASS. All 1209 retained frontend/production-parity
checks PASS, no skips. QA build/source/environment validation PASS. Entry
index-IbeDC0R9.js, 8,827,090 bytes, SHA256
caea163d6c11a937048e6cb5acaead2735e6050558c7b8280aff9b19b419a65c.
Archive SHA256 0df4f78798337092ad605c9120e8f2f76aecd7ee3e8518b64397189aaf242ce2.
