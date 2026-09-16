# Front Desk Amazon history access — applied in QA

PH5-AUTH-019. The isolated QA history table permits anonymous and all 12 fixture identities to read and update the synthetic row. Two live read/no-op-update matrices reproduced this; the exact business values remained unchanged. No production or Amazon provider operation was performed.

Root cause: `fdao_service_policy` grants all operations to PUBLIC and the SELECT policy also grants PUBLIC access. Candidate 034 restricts the service policy to `service_role`, scopes authenticated reads to active accounts with the existing Front Desk page permission and office access, and preserves the four existing UI Mark Closed roles for scoped updates. Imports and deletion remain service-only. Permission settings are unchanged.

Verification: 78 actual PostgreSQL checks pass, including original bypass reproduction, 13-identity enforcement, cross-office reassignment denial, inactive/unapproved denial, existing authorized writer roles, and service import/cleanup. The test runs without unapplied migration 032. Installation verification: 70 checks across 34 candidates pass.

Deployment: **applied after explicit approval on September 16**. All thirteen live identities pass read/update scope checks, including anonymous denial and authorized unchanged updates. See [the consolidated live results](access-restrictions-live-20260916.md). Production is unchanged.

The temporary fixture `QA TEMP PH5-AMAZON-20260916` is cleaned by exact ID/values; its audit entry remains and repeat deletion returned zero. Evidence is outside the repository in `qa-frontdesk-amazon-20260916.json` and `qa-frontdesk-amazon-scope-after-20260916.json`.
