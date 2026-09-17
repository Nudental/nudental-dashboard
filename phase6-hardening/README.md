# Phase 6 — production hardening

In progress, 2026-09-17. Baseline main: `820970ede7727830d95d8d03d518d02119da1acd`.
Live frontend: `277f68be-3819-410c-8ca6-6aa5ffa2a95e`, application source `bac8407c55ed684ffb2ec5dc3dd639cc0a736b4b`.
Dedicated branch: `phase6/nudashboard-production-hardening-20260917`.

Accounting evidence and correction proposals remain frozen. No financial records, role grants, production identities or provider connections are part of these migrations. The Phase 5 QA branch and all earlier backups remain preserved.

## Production authorization evidence

Read-only catalog and permission snapshots are retained privately under `work/phase6/evidence` and `/home/openclaw/.cache/nudashboard-phase6-20260917`. The committed permission fixture contains configuration only, with no account or business records.

| Role | Actual accounts / active approved | Office scope | Read / write | Approve | Admin | Prohibited |
|---|---:|---|---|---|---|---|
| Super Admin | 3 / 3 | All offices | Existing full access, subject to workflow invariants | Existing approval workflows; Front Desk self-review prohibited | Full existing administration | Forged actor, invalid transitions, self-review |
| Admin | 1 / 1 | All offices | 29 enabled page/action grants; underlying table rules also apply | Existing Huddle/EOD/Front Desk reviewer role | Existing user/provider administration | Explicitly disabled page permissions remain disabled |
| Regional Manager | 1 / 1 | All offices | 66 enabled grants; existing table restrictions retained | Huddle/EOD and Front Desk reviewer; no self-review | No user-admin grant | User administration, disabled inventory/payroll pages |
| Office Manager | 3 / 2 | Primary/assigned offices | 57 enabled grants; ordinary operational requests/tasks | No Front Desk approval; existing EOD/Huddle reviewer restrictions | No user-admin grant | Cross-office access, review fields, privilege changes |
| Staff | 36 / 6 | Primary/assigned offices, including explicit all-office assignments | All 138 page keys are false; existing module-specific database rules still permit some assigned-office operations | None established | None | No blanket grants added; page-scoped writes denied; module-specific rules are not replaced by a universal page-denial rule |
| Regional Clinical Manager | 0 / 0 | Role helper allows all offices | All configured grants false; no current user | Existing role is referenced in Huddle/EOD review code, subject to page access | None established | No synthetic production identity or grants added |
| Insurance Verifier | 0 / 0 | Existing office assignments; role permissions include all-office viewing | 11 enabled keys; insurance page/actions | Only existing insurance actions | None | Other modules and privilege changes |
| Marketing | 0 / 0 | Existing assignments | All configured grants false | None | None | No blanket grants added |

Five roles have accounts; eight exist in the database enum. Seven additional legacy textual labels occur in the permission table but are not valid production roles. They are preserved, not invented as new roles. No current profile has a provider-directory link. Provider filtering follows existing page and office rules, not a newly invented self-provider policy.

Frontend active-account gating is central; page checks are partly component-specific. Explicit false permission values override legacy fallback lists. Super Admin retains its existing bypass. Database helper distinctions are preserved: task management and office scope are not interchangeable. A Regional Manager page grant alone does not override the older task assignee/primary-office RLS.

Backend/API validation is still in progress. Some routes use a shared API key and service-role database access; existing session-checked routes provide an implementation reference. A page check must not be represented as complete API enforcement.

Native rollback-only reads exercised all 13 active accounts across 24 operational tables before and after the candidate policies. Queries succeeded, Super Admin visibility was unchanged, and no actor gained record visibility. Admin and Regional Manager retained three Front Desk batches for review despite their disabled catalog grants. Office-scope and disabled-page restrictions account for reduced visibility in other roles. These aggregate probes do not constitute production deployment or live write verification.

## Release controls

Each group must pass isolated PostgreSQL semantics, production-role fixtures, rollback and idempotence, then isolated hosted QA, before production. Snapshot owners/grants/policies/trigger enablement and affected-row fingerprints. Schema-only deployment transactions must assert unchanged rows. Do not deploy pending groups because a previous group passed.
