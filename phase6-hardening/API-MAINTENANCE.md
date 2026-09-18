# Legacy goal and EOD maintenance boundary

Candidate only; no deployment is claimed until its receipt and live checks pass.

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
