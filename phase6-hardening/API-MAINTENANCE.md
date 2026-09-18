# Legacy goal and EOD maintenance boundary

Deployed and verified from `288fdf7dc9feff34685ee169acef872ca5e1d7d5`.

The actual legacy goal handler accepted a synthetic write through an intercepted
service without a human identity. Its service sends to the legacy `goals` table
with the existing server credential. Ordinary office-goal screens use the
separate Supabase `office_goals` path, whose access was already reviewed in Group E.

This bounded change adds identity checks to only two write declarations:

| Route | Required authority |
|---|---|
| POST /v2/goals | Current active, approved Super Admin with all-office authority, matching existing Management administration |
| POST /v2/eod/unscheduled-treatment/sync | Current active, approved Super Admin, or Admin with the existing Sync grant; all-office authority required |

Ordinary EOD view access does not grant backend queue regeneration. Read-only
job identities cannot execute either operation. Query/body role claims and
office parameters cannot establish identity. GET goals and the ordinary EOD
read routes are unchanged. No route body, service calculation, database schema,
provider connection, schedule or credential is changed.

The reviewed frontend and 63 scheduled/dependent script inventory contain no
caller of these two mutations. Existing goal GET readers and direct scheduled
database/provider paths are unaffected. Positive native tests execute the actual
goal handler with synthetic storage and intercept EOD at its configuration read;
no production goal write or queue synchronization is permitted during validation.

Deployment probes must use only missing/invalid/read-only identities, an empty
goal body and `dry_run=true` EOD. A fresh rollback snapshot and original-row
fingerprints, including existing goal tables, are required before deployment.

## Legacy goal and EOD maintenance boundary — deployed

Source `288fdf7dc9feff34685ee169acef872ca5e1d7d5` applied at 2026-09-18T09:12:02.345983+00:00; main SHA256 `c3e8cce7e212b3d56e043e98cab682745ed402346f646074edb467286d90b333`. POST legacy goals now requires current active approved Super Admin/all-office authority, matching Management. Backend-only EOD queue sync requires Super Admin or Admin with the existing Sync grant and all-office authority. Ordinary EOD viewers and read-only job identities cannot execute either operation. Existing goal GET, ordinary EOD reads and every route body remain unchanged.

207 native API tests, 17 retained backend suites and 13 materializer tests PASS. The first local materializer attempt could not access its private temporary folders under the sandbox; the same tests passed with the required local access. The native suites recorded zero blocked network/business-data attempts. All 25 unrelated materialized files are unchanged. Candidate/live missing/invalid requests return 401 and existing read-only job identities return 403. Payroll validator remains 200. No real goal write or queue synchronization was executed; production mutation probes used only denied identities, an empty goal body and dry_run=true.

All 78,445 guarded original business/audit rows, including 36 legacy goals and 128 office goals, and all 83,957 original SQLite clinical/reference rows are preserved. No schema, provider/config/job/frontend change. Production/QA health PASS. The signed-in Sync Dashboard renders 29 jobs with no captured errors/alerts; no job was triggered. Recovery: `backup/api-before-phase6-maintenance-20260918`, `api-maintenance-backup-20260918T091128Z`. Private rollback copy preserved locally and remotely. Phase 6 and main integration remain in progress.
