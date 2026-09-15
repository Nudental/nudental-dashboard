# PH5-AUDIT-004 — Missing database audit for tasks

The task identity probes confirmed ten successful direct QA mutations with zero
matching task audit entries. All temporary records were cleaned up. The source
comment says a database audit covers row changes, but the copied schema has no
task audit trigger. Frontend semantic logging alone cannot cover direct API
writes or an interrupted browser request after the mutation succeeds.

`repairs/014-task-row-audit.sql` adds one trigger using the existing
`fn_audit_trigger`. Existing semantic task logs remain unchanged; uppercase
database INSERT/UPDATE/DELETE entries are separate evidence, not duplicate tasks.
No history is backfilled and no existing record is edited.

**9/9 offline checks PASS**: original gap, creation actor/values, acknowledgment
and completion actor/old/new values, stale update without extra history, denied
staff deletion, manager cleanup with retained deletion history, removed fixture
and unchanged disabled analytics trigger. Tests run with the task permission,
office, field and identity guards installed. Transactions are rolled back.

The existing audit function retains its nonblocking error behavior; this repair
does not redesign the shared audit subsystem.

Deployed only to the isolated QA database; saved SQL snippet
`632ce11e-4c04-4c1d-a9ef-3d2414e71538` confirms the trigger enabled. **14/14 live
Auth/PostgREST checks PASS**: manager creation, staff acknowledgment/start/
completion, exact actor and transition readback, stale update, denied staff
deletion, manager cleanup and permission restoration. The disposable task was
removed; its five database audit records remain. No production changes occurred.
