# NDASH-134 — Analytics chart controls overlap the neighboring panel

Severity: Medium. Status: reproduced; targeted layout repair in progress.

On live133 at the user's existing browser width, Scatter Plot remained inactive after repeated ordinary clicks. The chart panel spans x584–921 while its Scatter Plot button spans x1005–1131. Hit-testing at the button center returns the neighboring DIV instead of the button. A screenshot confirms the controls overflow into Statistical Summary. The current Line Chart remains selected; a blank scatter result is not claimed from these intercepted clicks.

Root cause: ChartVisualization switches its header to a desktop horizontal row even when the three-column page leaves the chart narrow. Its chart-type control row cannot wrap. The combined minimum widths exceed the panel width.

Smallest fix: stack the chart heading above its controls and allow the three existing buttons to wrap. Only two class attributes in `recovered-frontend/src/pages/financial-analytics/components/ChartVisualization.jsx`; no data, chart formulas, requests, permissions or configuration changes. Build and actual live geometry/click checks are the relevant verification; no implementation-mirroring class-name unit test is added.

Verification/deployment: pending. Retain all133andearlier behavior and unreleased042/066 boundaries. After the control can be operated normally, investigate the separate scatter data wiring against the existing marketing-spend source.

Pre-release: existing632testsPASS; production build39.08s; Rocket862confirms the same two classes/buildsuccess. Scoped actual-artifact two-attribute patch, complete reversal133 and seven retained dependencies PASS.

Status: CLOSED — PASS. Sourcea083d71, deployment54b0ccb9-ab87-4e8c-b7fc-4a2d6d2d1503, assetindex-236002b4626a.js, SHA256236002b4626ae6ab4a774a47fb6ec067b18260dbac9ec6c4c3367d28fb00b21b. Same browser width: Scatterbutton nowx609-735withinpanelx584-921, centerhitsbutton, ordinaryclickselectsScatter. Repeated Line/Bar/Scatter switching works; neighboringStatisticalSummary remains visible; fresherrors0. Exact published artifact/frontend/APIhealthPASS, three services active, backend131unchanged. No testrecords/businessdata/configurationchanges.

Separate follow-up now confirmed: when actually selected, Scatter renders zero marks with no explanation. Source has a permanentlyempty array. Existing cached marketing endpoint supports exact date/UUIDofficefilters and nonzeroJune totals; investigate connecting it safely next. This separate data-wiring defect is not claimed fixed by134.
