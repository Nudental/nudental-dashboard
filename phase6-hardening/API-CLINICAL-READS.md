# Directory, patient and appointment read boundary

Deployed and verified from `c255989905a562e295ce0ed7fc64963716dc323c`. 194 native tests, 17 retained suites, exact unattended caller review and fresh rollback/data gates PASS.

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

The release additionally fingerprinted 83,957 original SQLite patients, appointments, providers and locations through a read-only connection; all remained unchanged.

## Directory, patient and appointment read boundary — deployed

Source `c255989905a562e295ce0ed7fc64963716dc323c` applied at 2026-09-18T08:52:18.592198+00:00; main SHA256 `2f95be52354db8cdb47a960fbecce8ef3dce0d1742232738f4cf7bf19dfaa72b`. Eight route declarations now verify current human identity and their existing page/admin grants. Reference directories remain available to active approved signed-in pickers. Aggregate reads enforce actual office selectors, including supported CSV selections, and respect explicit disabled permissions. Raw patient/appointment lists and unscoped provider schedules require existing all-office administrative read authority.

The patient-service fallback reproduced returning a foreign-office synthetic record. The targeted repair filters mapped records before response limiting/cache; the SQLite path and unrelated service/route bodies remain unchanged. Existing bounded provider fetch limits are not increased. No real provider call was used in reproduction or tests.

194 native tests and 17 retained suites PASS with zero network/business-data guard attempts. The actual call-site inventory confirms none of the eight routes has an existing unattended caller; no job scope changed. Candidate/live missing or invalid identity requests return 401, read-only job credentials return 403, and the existing payroll validator remains 200. All 78,279 guarded business/audit rows and 83,957 original SQLite clinical/reference rows are preserved. No schema, configuration, job, provider-connection or frontend change. Production/QA health PASS.

The signed-in production KPI page renders its patient, appointment and treatment summary labels with no captured errors or alerts. This is read-only UI verification; no patient detail, workflow, provider sync or financial write was executed. Recovery: `backup/api-before-phase6-clinical-reads-20260918`, `api-clinical-read-backup-20260918T085142Z`; private backup preserved locally and on the server. Phase 6 and main integration remain in progress.
