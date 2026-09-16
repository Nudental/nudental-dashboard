# Front Desk Amazon history access — candidate only

PH5-AUTH-019. The isolated QA history table permits anonymous and all 12 fixture identities to read and update the synthetic row. Two live read/no-op-update matrices reproduced this; the exact business values remained unchanged. No production or Amazon provider operation was performed.

Root cause: `fdao_service_policy` grants all operations to PUBLIC and the SELECT policy also grants PUBLIC access. Candidate 034 restricts the service policy to `service_role`, scopes authenticated reads to active accounts with the existing Front Desk page permission and office access, and preserves the four existing UI Mark Closed roles for scoped updates. Imports and deletion remain service-only. Permission settings are unchanged.

Verification: 78 actual PostgreSQL checks pass, including original bypass reproduction, 13-identity enforcement, cross-office reassignment denial, inactive/unapproved denial, existing authorized writer roles, and service import/cleanup. The test runs without unapplied migration 032. Installation verification: 70 checks across 34 candidates pass.

Deployment: **NOT APPLIED**. Explicit approval for candidates 032 and 034 is pending. Automatic approval review previously rejected applying 032 because it required explicit authorization for that access-control change; 034 has not been attempted. Do not bypass that checkpoint or report either candidate as live verified.

The retained temporary fixture is `QA TEMP PH5-AMAZON-20260916`; its exact ID and values are recorded outside the repository in `qa-frontdesk-amazon-20260916.json`. Live post-repair checks and exact-ID cleanup remain required after approval.
