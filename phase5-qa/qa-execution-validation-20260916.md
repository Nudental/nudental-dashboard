# Live QA execution adapter candidate

The existing `ExecutionIntents` adapter previously had offline coverage only.
This candidate exposes its lifecycle through four QA-only route shapes under
`/qa/execution-intents`: create, read, history and cancel. It does not replace or
enable recovered operational handlers. The ten registered operations remain
payroll, compensation, payments, claims, insurance, scheduling, outreach,
report delivery, purchasing and bank sync simulations. Each has a fixed labeled
scenario for QA Office A/B. Arbitrary records, recipients, account numbers and
payload fields are rejected.

Fresh existing identity checks require an active approved QA super-admin. Other
roles cannot obtain execution permission from a financial page-view grant.
Existing role permissions are unchanged. Office checks, actor ownership,
bounded bodies, explicit QA markers and idempotency keys apply. Stored intents
and audit events survive adapter reloads; cancellation keeps audit history.
Production routes, provider credentials, network restrictions and service
configuration are unchanged. Product API readiness remains false.

All 129 retained QA Python backend tests pass, zero skips, using the server's
pinned dependencies. The 17 new tests cover all twenty registered scenarios,
concurrent duplicate handling, lifecycle persistence/cancel/retry, cross-actor
and ordinary-role denial, revoked accounts/roles, fixture/office boundaries,
malformed bodies/headers/routes, wrong environments and response minimization.
No external provider calls or process launches are used by the adapter.

This is execution-intent simulation coverage. It does not establish successful
external delivery, payment processing, claims acceptance, payroll calculation,
or full existing-product UI integration. Live deployment/verification pending.
