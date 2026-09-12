# NDASH-078 — Clearing the Dentrix Daily Summary date creates an invalid report range

Section: RCM / Dentrix Daily Summary. Severity: Medium. Status: repaired, deployed, live verification PASS.

Reproduced twice on frontend077: clear the report date using the native date control. selectedDate becomes empty, and the report heading renders `Report Date: | MTD: NaN-NaN-01 –`. The component continues its normal report-loading path with that invalid range. Restoring a valid date recovers. No business records changed.

Root cause: EAssistDailySummaryTab.jsx date input unconditionally assigns its value, including blank or browser-invalid dates, to required report state. mtdStart derives a Date from that unchecked value. The existing native max attribute does not prevent the event handler from accepting an invalid typed value.

Smallest repair: one onChange line calls setSelectedDate only when target.value is nonempty and target.validity.valid. The controlled date input retains the last valid report window otherwise. Existing date selection, max date, calculations, requests and other controls remain unchanged. No unrelated refactor.

Tests: four actual-handler cases reproduce three failures before; all345 frontend tests PASS after. Valid dates, month/year/leap boundaries, empty input, browser-invalid future/partial input and missing events are covered. Production build39.29s PASS. Rocket806 completed this same one-line change.

Actual release: one compiled input callback scoped inside the893-byte date input. The extractor accounts for the existing compiler's block-form optional-chain transform. Actual compiled handler tests PASS, entire entry reverses exactly to077, all prior repairs and seven dependency relinks pass. Candidate index-b025fcf8d50e.js; backend076 unchanged and077 retained. Blocked042/066 remain excluded.

Live closure PASS: deployment14c8cfbb-897c-4532-9b8d-f2c524b1f40c, index-b025fcf8d50e.js, SHA b025fcf8d50e652526e9b03b13c74468af19840b90258fdef92b6d785763f4e6. Fresh release load opens Sep11report. Clear twice keeps2026-09-11 with MTD2026-09-01–2026-09-11; no NaN range. Gross17655/net7792.75/collections5617.44 remain intact. Native day change toSep12 works and produces expected zero daily totals. AttemptingSep13 beyond existing maxSep12 retainsSep12. RestoreSep11 and component refresh return the same populated figures. Alerts/errors0; frontend/API200 and three existing services active. Backend076 unchanged,077 rollback preserved. No business data writes, provider sync or exports.
