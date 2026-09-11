# NDASH-040 — Unsupported expense and profit trend series

Status: repaired and tested; deployment pending. Severity: High (misleading financial interpretation).

Financial Analytics default line and bar charts show revenue, expenses, profit. Source monthly mapping hardcodes expenses0 and calls max(netProduction-totalCollections,0) profit. Neither an expense query nor an authoritative profit value backs these series. Actual live bar chart has three corresponding series. No financial data changed.

Targeted correction: remove invented expense/profit fields, retain the existing net production and collection values, show only named Net Production and Total Collections series in line/bar modes, and clarify the chart title. No new API calls, financial recalculation, date/filter changes or configuration changes. Trailing-window scope and unbacked Marketing scatter are separate findings to investigate afterward.

Changed only financial-analytics/index.jsx and components/ChartVisualization.jsx. Three focused tests failed before and pass afterward; full retained suite146 PASS; source build PASS35.00s. Actual production chart renders two modes with expected backed metric keys/names; actual mapping preserves80000 production/60000 collections and no longer invents20000 profit or zero expenses. No business requests in isolated tests. Six scoped main regions, exact reversal, syntax and unchanged dependent body checks PASS. Initial ambiguous reverse marker was rejected locally before staging; corrected by replacing adjacent series regions together. Rocket version772 completed the same changes.

Automatic upload review initially rejected destination authorization. A permitted read-only check confirmed137.184.165.120 is yadon-abem-01 and its039 asset hash matches the live release; retry is limited to the already authorized existing Dashboard workflow, public code assets and verification metadata, with no business data or secret values.
