# Expense API access and literal query encoding

Status: candidate; not yet activated. Production remains at API source `749d8ee3900c25169f7c59e467f764665c91329b` until a passing release receipt is recorded.

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
- Production activation: pending.
- Frontend source unchanged; the previously passing 1,660-test build remains deployed.

No financial source record, accounting proposal, classification, archive, provider connection, production schema or business action is changed by this candidate.
