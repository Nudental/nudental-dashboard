# PH5-AUTH-008 — disabled task-page permission did not restrict direct API access

Reproduced using the actual QA staff identity and a single assigned synthetic
task. workflow.tasks.view was false; both navigation and direct task-page entry
denied access. Authenticated PostgREST still returned the task. Existing task RLS
checked role/office/assignee but not the page permission enforced by useRbacGuard.

008-task-page-permission.sql adds a restrictive authenticated policy requiring
the existing enabled role permission or the UI's existing super-admin exception.
Existing office, active-profile, assignee and operation-specific rules remain.
No role grants are changed by the migration. QA installation/environment guarded.
Migration SHA256 c94dc320ea017c358aaa0318040ade7f471aef5068d21d479774e872fcb43f3c.

Eleven copied-schema tests PASS: original bypass, disabled/missing permission,
read/write denial, enabled roles, scope preservation and super-admin exception.
The candidate enum-to-text comparison was corrected during offline validation
before deployment. Applied in confirmed QA SQL editor; catalog returned one
RESTRICTIVE ALL policy and the query was saved. No production policy changes.

Eight live Auth/PostgREST checks PASS: disabled staff read/update/insert denied,
manager/super-admin access retained, disabled regional-clinical-manager denied,
original task unchanged. No probe row remained. After these checks only the QA
staff role's existing task-view flag was temporarily enabled to test the intended
assigned-task lifecycle. Its original false value is recorded in a workspace
journal and MUST be restored when that bounded workflow test finishes.
