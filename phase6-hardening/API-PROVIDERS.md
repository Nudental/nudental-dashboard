# Provider access and OAuth callback hardening

**DEPLOYED and verified** at 2026-09-18T14:36:16.903788+00:00, source `78cc78da4affc54f4308a4731551a46f30854e17`. Recovery: `api-provider-read-backup-20260918T143542Z`.

Review covers 22 existing route declarations: 20 provider controls/readers and two OAuth callbacks. One minimal Gusto authorization-URL route is added because no existing state-producing Gusto setup caller was found in the available source. Twenty-one control/read declarations use the current-human boundary. Catalog/status retain the existing Front Desk page permission. Global banking/provider setup, unscoped carts, sync and direct ordering require the current active approved Super Admin; an office parameter or shared key cannot grant that access. Existing office-scoped request/review rules remain unchanged.

Three existing unattended consumers retain only their existing exact GETs through separate identities: `plaid-sync` (accounts/transactions), `morning-brief` (accounts), and `payroll-balance-watch` (accounts). They cannot use cursor sync, setup, purchase, arbitrary routes or write methods. Their loopback destinations are fixed and redirects are refused. The two external script adapters preserve all AST except the exact request expression. No complete job was executed, and schedules are unchanged.

Reproduced defects: Gusto ignored authorization state and could overwrite a saved connection with a failed token response; Amazon accepted callback state when none was stored. OAuth intent now requires a short-lived one-use nonce created by a verified administrator, stores only its hash separately from provider credentials, and uses a process lock to prevent replay across API instances. Callback failure does not replace the existing connection; reflected provider errors and submitted HTML are withheld. Provider credentials, scopes, existing redirect URLs, refresh logic, business calculations and records are unchanged by deployment. Initiation/callback positive tests use synthetic transports; no live provider authorization, sync, delivery or purchase is performed.

Verification: **324 guarded native API tests**, **17 retained backend suites**, **13 materializer tests**, and **two exact external-caller synthetic transport checks** PASS. No blocked network/business-write attempts. Unrelated main route bodies, Amazon refresh/business functions, Plaid financial processing, and 28 other materialized files are unchanged.

Evidence: `api-provider-read-contracts-v1/receipt.json`, `api-provider-read-retained-v1/summary.json`, `api-provider-callers-v1/manifest.json`, and `production-api-provider-read-receipt.json` in the existing private Phase 6 server evidence directory. The release receipt reports PASS. Source/config/caller snapshots and current Pages IDs are recorded before activation; rollback restores only this bounded release and preserves the previously rotated validator credential.

The two Collaboration daily-report gates remain independently pending: `/v2/rcm/ar-aging-official` and `/v2/rcm/ar-location-health`. No Collaboration restart or scheduler activation is included in this release.

Protocol references: [Gusto OAuth](https://docs.gusto.com/app-integrations/docs/oauth2) and [Login with Amazon authorization code grant](https://developer.amazon.com/docs/login-with-amazon/authorization-code-grant.html).
