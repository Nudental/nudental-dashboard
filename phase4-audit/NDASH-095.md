# NDASH-095 — Insurance drawer close button is underneath the header

Status: verification in progress. Severity: Medium.

Reproduced twice on the native Insurance queue: opening an existing completed request displays the drawer, but clicking its X opens the account menu. DOM hit testing confirms the close-button center hits the header, not the drawer. The backdrop can dismiss it. Header z-index100 exceeds drawer50 and backdrop40.

Root cause: RequestDetailDrawer returns a fragment, leaving its existing fixed layers below the global header. Targeted two-line repair replaces only the outer fragment with a relatively positioned div at inline z-index210. It groups the existing backdrop, drawer and four confirmation dialogs without changing their internal stacking, handlers, permissions, reads or business actions. Inline positioning requires no production stylesheet change.

Three isolated render regression cases: layer-above-header fails before; both existing close handlers and four dormant confirmation dialogs pass. All416 tests PASS after. Local production build30.29s PASS. No business records created or changed. Rocket, actual compiled artifact, deployment and live verification pending. Frontend094 is retained rollback; worker093 and backend085 remain unchanged.

Rocket initially confirmed zIndex0 (not released); follow-up explicitly corrected and confirmed actual file210. Actualcompiledroot PASS, all six children byte-identical, full094 reversal, retained repairs and seven dependency relinks PASS. Candidateindex-10301ca002d9.js; private source8053b59. Deployment pending.


CLOSED PASS. Deployment4587f4a5-a81d-44b0-81ce-8ab767e8158f/index-10301ca002d9.js. Livebaseline2;close-buttoncenter now hits itself; wrapperrelative/z210;Xcloses/accountmenustaysclosed;reopen/audit15entries/backdropclosePASS;commasearch0normalempty/Clear+Refresh2/errors0. NativeInsurance/root/API200/3servicesactive/backend085andworker093unchanged.094rollbackretained. No business-data changes.

