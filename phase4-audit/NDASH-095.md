# NDASH-095 — Insurance drawer close button is underneath the header

Status: verification in progress. Severity: Medium.

Reproduced twice on the native Insurance queue: opening an existing completed request displays the drawer, but clicking its X opens the account menu. DOM hit testing confirms the close-button center hits the header, not the drawer. The backdrop can dismiss it. Header z-index100 exceeds drawer50 and backdrop40.

Root cause: RequestDetailDrawer returns a fragment, leaving its existing fixed layers below the global header. Targeted two-line repair replaces only the outer fragment with a relatively positioned div at inline z-index210. It groups the existing backdrop, drawer and four confirmation dialogs without changing their internal stacking, handlers, permissions, reads or business actions. Inline positioning requires no production stylesheet change.

Three isolated render regression cases: layer-above-header fails before; both existing close handlers and four dormant confirmation dialogs pass. All416 tests PASS after. Local production build30.29s PASS. No business records created or changed. Rocket, actual compiled artifact, deployment and live verification pending. Frontend094 is retained rollback; worker093 and backend085 remain unchanged.
