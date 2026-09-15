# PH5-AUTH-012 — Task creator and lifecycle identity

Live QA reproduction used 12 separately labeled disposable tasks. Seven expected
denials were bypassed: staff creation, a manager forging the creator, insertion
with another actor's completion, staff forging an acknowledgment actor, rewriting
the original acknowledgment timestamp, writing completion metadata outside its
transition, and a manager rewriting the creator. Five existing allowed/denied
behaviors passed. All fixtures were cleaned up and the temporary staff task-page
permission was restored to false.

Root cause: `action_items_insert` checks only office access, and the existing task
field guard permits lifecycle fields without binding them to the authenticated
actor. The frontend supplies creator/actor fields and preserves first timestamps,
but direct PostgREST writes do not enforce those contracts.

Candidate `repairs/013-task-identity-boundary.sql` adds one trigger. Authenticated
creation requires an existing task-manager role, the current creator and an
initial submitted/pending state. Creator identity is immutable. New lifecycle
metadata requires the current actor and matching status transition; established
lifecycle values cannot be overwritten or cleared. Existing office, active-user,
page and manager-field protections remain in place. Manager reassignment,
ordinary status changes and reopening while retaining history are preserved.
The nonexistent legacy `clinical_manager` frontend string is not introduced as a
new database role; all five supported task-manager roles are exercised.

**26/26 offline PostgreSQL checks PASS**, including 12 negative-control bypasses,
all five supported manager creators, staff lifecycle transitions, denied metadata
forgery, historical-value preservation, ordinary manager edits and office scope.
Test records were rolled back. Original schema/templates remain unchanged.

Deployed only to the existing isolated QA database. SQL snippet
`ebfabe7a-6a2a-4bc5-acdc-16cbb469b00d` confirms the trigger enabled. The identical
**12/12 live cases PASS**, with no unexpected allows. All temporary fixtures were
cleaned and the staff permission was restored. The manager task page still loads
its original single completed task, correct counters and New Task/Edit controls.
No production database or policy changed.
