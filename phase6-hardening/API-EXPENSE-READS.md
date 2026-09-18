# Expense API access and literal query encoding

Status: DEPLOYED AND LIVE VERIFIED.

## Evidence and scope

The seven existing GET readers are `/v2/expenses/{filters,summary,lines,breakdown,amex,payroll,wf}`. Their existing shared-key dependency does not identify a current approved user. Synthetic tests execute six real handlers with fake storage and reproduce shared-key-only admission. No live business writes or provider operations were used.

Fresh production permission inspection found Expense grants only for Regional Manager (parent + Overview) and Super Admin (parent + all applicable tabs). Both groups currently have all-office scope. Admin is not granted Expense access merely by role; Super Admin retains the existing override. Current active/approved account resolution and explicit permission denials remain authoritative.

These readers are not uniformly office-isolated: Summary retains company production/collection context; Payroll retains global run and contractor totals; Filters exposes global cardholder/card metadata; Wells returns the complete configured account map. The boundary therefore requires all-office authority plus current parent/child grants. An office query is a report filter, not proof of restricted-office isolation. Future restricted-office API access would require separately reviewed response shaping; no such grant is added here.

Overview retains the line and AmEx dependencies already loaded by the current page. Transactions-only access does not grant Payroll or Summary. Import-only access grants filter metadata only. No writes are admitted.

## Confirmed query defect

Using actual `expense_lines` and `_expense_date_filter` with fake storage, a date containing a URL fragment removed the later office selector from the HTTP request. A department containing `&` also split the REST query incorrectly. The normal synthetic office test returned one record; the fragment variant returned two. No real data was used.

The fix percent-encodes each interpolated REST filter value in the five affected handlers (60 values). It preserves query syntax, valid literal text, calculations, source tables, posted/archive filters and existing financial classifications. The Wells handler uses parameterized/local reader paths and receives no encoding edit. Canonical AST comparison removes only the reviewed boundary registration, local encoding imports and encoding wrappers; the remainder must be identical to current production.

## Existing unattended reader

`validate_reconciliation.py` already calls Expense Summary. Its existing `validator_headers` helper reloads the private exact-route file for each request. The existing reconciliation-validator identity gains only `GET /v2/expenses/summary`, with its current credential and expiry unchanged. No other job gains this route; no wildcard or write scope is added.

Deployment first installs compatible policy/dispatcher code with the legacy main unchanged, verifies existing payroll reads, updates the exact registry and helper route, verifies the unchanged Summary response, and only then activates the human boundary and encoded queries. Rollback restores the immediately captured current source and job configuration, never the previously revoked credential.

## Verification

- 267 native identity/handler tests: PASS, zero guard attempts.
- 13 materializer tests: PASS.
- All financial calculations and unrelated main AST: unchanged.
- 27 unrelated materialized files: unchanged.
- 17 retained backend suites: PASS, zero guard attempts.
- Production activation and live UI: PASS.
- Frontend source unchanged; the previously passing 1,660-test build remains deployed.

No financial source record, accounting proposal, classification, archive, provider connection, production schema or business action is changed by this candidate.

## Expense read boundary and query encoding — deployed

Source `d5c6da689852e41eaa3087d42ef274a7e654bdda` applied at 2026-09-18T12:16:35.660036+00:00; main SHA256 `681aa6a12f0b9b7fbef6e914d47b82bf441dbbfa0a3fd7f4e48af1923a9b3cce`. Seven existing Expense GET routes require a current approved human, all-office authority and their parent/child page grants. All-office authority is required because existing Summary/Payroll/Filters/Wells responses contain global components or metadata; no report filter is misrepresented as isolation. Current Regional Manager Overview dependencies remain available. Calculations, classifications, posted/archive rules and records are unchanged.

A synthetic actual-handler test reproduced malformed-date fragments removing a later office selector and an ampersand splitting a department value. Sixty interpolated filter values in five handlers now use literal URL encoding. Canonical AST preservation verified that only encoding and access-boundary plumbing changed. No malformed request was sent to production.

267 guarded native tests, 17 retained backend suites and 13 materializer tests PASS. The existing reconciliation-validator gained only its already-used `GET /v2/expenses/summary` route, retaining its current credential and expiry. Its dispatcher compatibility and unchanged response passed before the human gate activated. Other job identities/helpers remain unchanged. All seven missing identities return 401; off-scope reads and job writes return 403; permitted Summary and Payroll reads remain 200. The same-period Summary result is unchanged. All 78,471 guarded original Supabase rows and 83,961 SQLite rows are preserved. Production, QA and QA API health PASS. Frontend/provider configuration and the frozen accounting register remain unchanged.

Live signed-in Expense (This Year / All Offices) reloads without alerts, permission/load warnings or captured console errors. Filters and Overview render. Live positives used Super Admin; restricted/other roles were tested synthetically. No provider, export, financial, clinical or approval action occurred.

Recovery: `backup/api-before-phase6-expense-reads-20260918`, `api-expense-read-backup-20260918T121559Z`. Private backup files stay on the server. Restore only the freshly captured current job configuration; never reinstate the previously revoked credential. Remaining API review, final regression and canonical-main integration are still open.
