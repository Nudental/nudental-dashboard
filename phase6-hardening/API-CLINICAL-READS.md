# Directory, patient and appointment read boundary

Candidate only. 194 native tests and 17 retained suites PASS; exact unattended
caller compatibility and the fresh deployment/rollback gates remain pending.

Eight route declarations are covered:

| Read | Required access |
|---|---|
| Offices / providers | Current active, approved signed-in account; existing professional/business reference directory remains available to pickers |
| Patient summary | Existing relevant Executive, Office Performance, Finance, Operations, KPI or Reports permissions and actual office scope |
| Appointment summary | Existing relevant Executive, Operations, KPI or Reports permissions and actual office scope |
| Patient demographics | Existing Operations Services permission or Super Admin Management, plus actual office scope |
| Raw patient / appointment lists | Existing all-office Sync/Data Health administrative read authority |
| Provider schedule | Existing all-office administrative read authority; its handler has no office filter or known scoped frontend consumer |

No patient list, schedule or compensation access follows from the professional
directory grant. Office-scoped summary reads require an actual officeId or
locationId consumed by the handler. Conflicting, duplicate, unknown or ignored
selectors cannot grant access. CSV office selections are accepted only on the
two existing summary routes, and every selected office must be assigned.
Relevant legacy frontend fallback permissions are preserved; explicit false
values still override defaults. No new role, assignment or permission is created.

The actual patient service fallback reproduced returning a synthetic foreign-
office patient when the SQLite cache path was unavailable. The repair applies
the requested office filter before response limiting/caching. It does not raise
the bounded provider fetch limit: a fallback may return fewer selected-office
records than the limit. The SQLite path and existing calculation bodies remain
unchanged. No real provider fetch was used to reproduce or test this issue.

Tests use actual route functions and patient-service methods with synthetic
storage, and verify office aliases, CSV scope, false permission overrides,
aggregate-versus-detail separation, directory access, scope-specific caching and
the unchanged SQLite query. All unrelated route/service bodies and 23 unrelated
materialized files are unchanged. Candidate verification cannot authorize any
provider sync, job execution, patient write or financial correction.

The bounded release script will additionally fingerprint original SQLite
patients, appointments, providers and locations through a read-only connection.
No fingerprint preservation or live deployment is claimed until its receipt and
browser regression pass.
