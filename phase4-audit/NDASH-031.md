# NDASH-031 — Missing separately loaded application files

Section: Gusto subviews, Help Manual and client export dependencies. Severity: High.
Status: deployed; live code-loading verification PASS. Data/workflow audits continue separately.

Live reproduction: Benefits fails with a network-error panel and Retry repeats the failure. Browser reports failed dynamic import of GustoBenefits-crX-xJ9D.js. All four Gusto code-file URLs return200 text/html rather than JavaScript; static fallback masks the missing assets.

Root cause: the original preserved deployment contains only its main JavaScript and stylesheet, plus images. All eight relative dynamic imports are absent: Benefits, Pay Schedules, Import History, Time & Attendance, Help Manual, date-fns, Canvg and DOMPurify. The current release preserves that original omission; original Rocket asset URLs also return404.

Repair candidate: restore only the eight rebuilt code files from the preserved frontend source.119 shared export interfaces match the currently deployed main script after normalizing local variable names and instrumentation. Keep the functioning main implementation and stylesheet; change only its eight missing-file references. Added files import the resulting main script and receive unique release names, so older browser sessions cannot accidentally import a second main script. No provider calls, business writes, backend, authentication or infrastructure changes.

Tests: all eight code files parse and have a complete dependency graph; five screen modules link and render in isolation with zero business-data requests.119 shared interfaces match. Exact reference-patch reversal restores the current main script. Source build and100 frontend tests from030 remain valid; source application code is unchanged.

The existing deployment helper now verifies added-asset checksums and refuses missing relative JavaScript dependencies. Original and current deployments remain preserved for rollback. Benefits data/error/export behavior still requires its functional audit after the code-loading defect is repaired.

Deployment: `8aadca0d-cc06-4a51-8376-0cd39e534203`; main asset `/assets/index-4041253c50b0.js`, SHA256 `4041253c50b0b63b5044916dd8b358b96d5a5e8ec15d06b75b84427e88f9d230`. All eight added assets returned200 JavaScript with exact candidate checksums. Existing backend stayed at030 SHA18f3000e...; no configuration or business-data changes.

Live verification: Benefits, Pay Schedules, Import History and Time & Attendance now render instead of failed imports. Help Manual opens at `/help/manual`; searching payroll narrows the menu and selecting Payroll shows its heading. Returning to Gusto Overview preserves AllTime paid contractors61,847.92 and regular122/off-cycle35. Earlier browser import errors remain in retained console history; no fresh code-loading failure occurred after this release. Client export libraries are verified delivered and dependency-complete; their individual export workflows remain part of the continuing audit.

Private source-control commit67e8976 preserves the manifest, compatibility evidence and deployment guard. Pre031 release f0f51264... and all original snapshots remain recoverable. No test/business records were created.
