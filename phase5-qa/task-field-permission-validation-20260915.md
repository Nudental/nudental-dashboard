# PH5-AUTH-009 — Staff can edit manager-only task fields through the API

QA Staff had no task edit control, but a direct authenticated request changed the
tracked temporary task's priority from medium to high. The original value was
immediately restored. action_items_update checked row/assignee access without
restricting which fields that assignee could change.

009-task-field-permission.sql adds a QA-only BEFORE UPDATE guard matching the
existing UI's manager roles. Other authenticated roles can update status and its
existing lifecycle fields; task content, priority, due date, ownership and source
metadata require a manager role. Existing row, office, active-profile and page
permission policies remain in force. Trusted fixture/import behavior is retained.
This repair does not add lifecycle transition rules or change production policies.

All 14 offline PostgreSQL checks PASS, including the original bypass, field denial,
ordinary lifecycle updates, manager edits and office scope. Deployed through the
isolated project's SQL editor; trigger readback confirmed enabled. All nine live
Auth/PostgREST checks PASS and the temporary manager priority edit was restored.
QA Staff then completed the original task through Mark Complete. The row, actor,
completion timestamp and exactly one task_completed audit entry persisted;
refresh displayed Completed 1. No frontend/API publication was needed for this SQL
repair. The current frontend's 1218 tests and 17 hosted checks passed earlier.

The task and its notification remain tracked for cleanup. Its linked Huddle stays
available for submission/review tests. The temporary QA Staff task-page permission
was restored to its original false value after the bounded tests. All eight live
page/API permission checks passed again; the staff UI again denies Team
Assignments. Restoration is recorded in the temporary-permission journal.
Production unchanged.
