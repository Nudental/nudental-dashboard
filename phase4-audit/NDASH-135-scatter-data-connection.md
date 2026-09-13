# NDASH-135 — Scatter Plot has no connected data

Severity: Medium. Status: repaired, deployed and live verified PASS.

After134 made ordinary clicks work, Scatter Plot was activated twice on live134 and rendered zero marks without a notice. Switching to Line and Bar produced the existing financial series. Root cause: ChartVisualization uses a permanently empty `scatterData` array; no reader supplies marketing amounts.

Existing source verified before editing: `/v2/marketing/amex-spend` reads cached Supabase expenses, with posted/archived statuses and established vendor classification. JuneAll/Barnegat/Brick and partialJune1-15 return nonzero aggregate totals, exact date/filter echoes. Office filter is a Supabase UUID, not a Dentrix numeric location ID. All includes Corp expenses, so use its canonical total rather than summing only four offices. The current backend function exactly matches inspected source SHA2d845d5fcf279bf2c0ded23cedcc050760929c66929fb576f554cad38dbb440a; its shared reader paginates. No provider sync or accounting reinterpretation.

Targeted change: request existing marketing totals only while Scatter is selected, pair them with verified monthly net production for identical periods/offices, validate response metadata/core amounts, deduplicate offices and limit concurrency to four requests. Date changes/unmount ignore stale results and stop queued work. Keep genuine zeros; show missing/error/loading states instead of invented points. Tooltip identifies month, AmEx marketing spend and net production. Existing line/bar, comparison/forecast calculations and134layout remain unchanged.

Files: dentrixNormalizedService.js (scoped reader); ascendApi.js (existing-endpoint method); financial-analytics/index.jsx (period/source metadata on existing trend points); ChartVisualization.jsx (Scatter state/render).

No business-data changes.

Pre-release: 645 frontend tests PASS, including13new source/queue/date/scope/error/race tests. Production build38.30s. Rocket863implemented four-file change;864restored existing summary-card visibility as requested (only target-line legend hidden inScatter). Scoped compiled reader/effect tests PASS; nine targeted regions, full reversal134 and seven retained dependency modules PASS. No backend/API configuration changes.


Release: source43efe70; deployment92015d14-7f46-4a90-9900-f055c6273ef3; index-0ba3b9822cd0.js SHA0ba3b9822cd0ad6a8993002e12686b1323f337db1a04bc0c5cf2b8fe0c2cb490. Exact published asset verified; backend131 unchanged, all three services active. Previous134 release and assets retained; blocked042/066 excluded.

Live PASS: fresh browser loaded135. All/Barnegat/Barnegat+Brick each rendered12monthly points, June26 tooltip X/Y matched independent source fingerprints (All bbbdb9d5/8fc4d894; Bar9b92f011/1b24b61c; pair093e0883/afd0ac40). PairJune1-15 matched820529f7/13b3295d, proving exact partial-period handling. Existing summary cards remained; Line24dots and Bar24rectangles rendered;134toolbar bounds/hit-test retained; no new browser errors. Error/cancellation/no-partial-result paths verified by source and actual compiled controlled tests; no production outage induced. No provider sync, business-data writes or credentials/configuration changes.
