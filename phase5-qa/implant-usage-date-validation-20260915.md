# PH5-IMPLANT-003 — Usage calendar date displays the previous day

The live QA usage form saved procedure_date `2026-09-15`. Its usage table displayed
`Sep 14, 2026` in America/New_York, including after refresh. Independent readback
confirmed the saved date was correct and the single usage record/stock 6 persisted.

`ImplantUsageLogTab.formatDate` parsed the date-only column as midnight UTC and
then formatted it in the browser's local time zone. Adding `timeZone: 'UTC'` to
that existing formatter preserves the stored calendar date. This one-line change
does not alter saved records, timestamps, inventory, or any other date renderer.

Actual-formatter tests reproduce the failure in New York and Los Angeles; UTC,
Tokyo and missing-value cases already pass. All five now pass, covering normal,
DST-boundary and leap dates. All 1,281 retained frontend tests pass with zero skips.
QA build, 510 source-file comparisons, and environment/credential checks pass.
Entry `index-DIh69IfL.js`, 8,828,356 bytes, SHA256
`8ab564eb4a2e4851bff9178d133a8c782d671bb4fa3b09d13c1d5865a5d3d571`.

Live repeat pending. Existing test usage `cb95d4e3-b4db-4a34-8593-ce25f4dfdf24`
is reused without another write. Production remains unchanged. The separate
Used This Month count defect is queued for its own targeted correction.
