# NDASH-032 — Benefits CSV ignores selected filters

Section: Payroll / Gusto / Benefits. Severity: Medium. Status: deployed; live PASS.

Live reproduction after restoring its code file: select Inactive. There are zero visible enrollment rows, but Export Benefits CSV stays enabled. Safe source HEAD counts confirm38 total enrollments, all38 active, and8 plans. No real Benefits CSV was exported.

Root cause: the table and totals use filteredEnrollments, but handleExport maps the original enrollments array and the button tests that unfiltered array. Selecting a plan/status can therefore export unrelated employee benefit records. Targeted repair: use the already filtered collection for the CSV and disabled state; no data or financial-calculation changes.

Testing is isolated with synthetic QA rows. The broader source-row query was rejected by automatic approval review; a safer aggregate-only request succeeded for counts. Database SUM aggregates returned400, so independent financial sums remain unverified. No full employee source records were retrieved by those audit queries, and no permissions/configuration were changed.

Verification before release:105 frontend tests PASS; production build29.31s. Five focused source cases and five actual deployed-module cases pass; before repair only the unrestricted-export case passed. No real Benefits file exported.

The actual deployed chunk changes only four identifier references implementing the two source lines. Cache headers are public,max-age=14400,must-revalidate, so corrected files receive new version names. Seven entry-dependent files are relinked to the new main script; unrelated module bodies stay identical. The full prior graph is retained for existing sessions. Immutable files are hard-linked in private snapshots to preserve recovery without multiplying storage. No deployment configuration or backend changes.

Release: ea7b1cbc-ef0d-4dc3-a5f0-56d0bad724f4; main /assets/index-1f6cc164d276.js, SHA256 1f6cc164d276e250592173f5d6c91396241450de4ac64c01f6f442d85da5e02c; private dist ndash032-dist. Backend remains18f3000e310ec982bfa53b5e5cc345e79f883e9e4a3fc192fd0e5b0a7c14bde9.

Live after refresh: Inactive filter produces0 rows and disables Export; two plans with0 matches disable Export; a plan with4 matches enables Export. Defaults restored to All Plans/All with38 rows. CSV content was verified using synthetic fixtures against both source and the actual deployed module, without exporting employee data. New module HTTP200/JavaScript PASS. No business records changed.
