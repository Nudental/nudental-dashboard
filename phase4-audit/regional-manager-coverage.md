# Regional Manager supply requests — coverage

- Read-only September empty state and historical May requests verified. Native month keyboard changes commit and persist across filter changes.
- Front Desk and Clinical/Back Staff tabs verified. May has two clinical parent requests; department counters match rows.
- Office card filter Brick returns only its request; clearing restores All. Submitted status returns the submitted row; Urgent request-type filter produces the expected empty state; All restores monthly requests.
- Catalog item search fixed/verified019; two different contained item names each return one parent, uppercase/whitespace office search works, no-match and Clear recover. Custom-name and missing-relationship matching covered by isolated tests.
- Item counts fixed/verified020; both parents show2, expanded detail shows two actual item rows. Office sorting ascending/descending verified. Expansion/collapse works and only fetches read data.
- Refresh healthy; default month resets to current month, then historical results can be fetched again. No browser errors during completed checks.
- Monthly export clicked with a submitted-status filter. No generated browser tab appeared in the available browser inventory. File/tab output remains UNVERIFIED; do not claim application failure solely from this in-app popup limitation. Source uses window.open plus document.write; no external send. Its string interpolation of data fields should receive focused escaping review with synthetic data; no business notes were altered to test this.
- No isolated production write fixture created. Existing old records with notes saying test are not audit-owned and were not modified or deleted.
- Intentionally untested: save review, approval/rejection, bulk decisions, request submission, fulfillment, notes changes and associated notifications. These affect real supply requests and can send business email. Requires a dedicated Dashboard test environment.
- Urgent positive-data cases and non-admin permission behavior remain unverified where no safe fixture/account is available. Current status options also omit draft/fulfilled despite corresponding schema states; inspect intended workflow before changing approval behavior.
