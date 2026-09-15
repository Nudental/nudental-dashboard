# PH5-EOD-005 — treatment tabs use a fixed office catalogue

After PH5-EOD-004, both Unscheduled Treatment and Treatment Plan Completion still
displayed Unknown Office for the signed-in QA office manager while the page header
and Dentrix Closeout correctly displayed QA / Office A. Both child tabs used
getOfficeNameById and OFFICE_LIST, which contain a fixed four-office catalogue.
The selected QA office exists in the authenticated directory but not that map.

The targeted repair changes only these two components: read offices from the
existing OfficeContext, resolve the selected name from that directory first, and
use its accessible offices for the picker. The existing role gate, report calls,
calculations, and fallback display helper remain unchanged. No office records or
permissions are changed. Empty accessible lists no longer offer unrelated fixed
catalogue offices.

- 10 focused checks: 0/10 before, 10/10 after. Covers new/renamed offices and exact
  zero-, one-, and two-office picker scope.
- Complete retained frontend suite including production comparisons:
  1,079/1,079 PASS, no failures or skips.
- QA production build PASS; all source inputs match the current candidate.
- QA-only connection policy/banner PASS; production client credentials and
  server secret absent. Static configuration remains byte-identical.
- Entry index-C8fZR7PY.js, 8,821,667 bytes, SHA256
  e2f438a9ce25c457de44f7b26be60c62f7dc752e8c8cdba771152c56d901601a.
- Archive SHA256
  080bb2382379e00c9d551d471e87bb1dab94fe9c88666a6d25e7e68555413f7a.

QA deployment 6c81bf22-5f1c-46b2-97a8-ebcb7c1146de succeeded from 46d8cd28.
Live verification PASS: after refresh, the existing synthetic office manager
sees QA / Office A in both treatment tabs. Dentrix Closeout retains the correct
office and restored September 15 date. Treatment Plan Completion retains its
existing date defaults. All 17 hosted artifact and boundary checks PASS.

No database fixture was added by this repair. Prior QA deployment
a101df8f-f343-4034-a9d6-1ee908bc373e remains recoverable. Production deployment
1f1f91bc-5dbd-4500-8bfd-d4e2039ba601 is unchanged. Report API readiness remains
pending separate route review; no provider request or execution was enabled.
