# NDASH-006 — Unmatched provider search removes the search control

Reproduced twice on live /kpis > Providers. Entering __NDASH_QA_NO_MATCH__ removed the search input and showed the generic no-provider-data message. Clearing the query was impossible without leaving/reloading the tab.

Root cause: ProvidersHeatmapTable returned its empty-dataset view whenever the filtered results were empty, before rendering the input.

Fix: the early empty state now applies only when the filtered list is empty and no search is active. An active unmatched search keeps the input and empty table, enabling immediate clearing. Existing empty-period, loading, search, export and ranking behavior remain otherwise unchanged.

Five actual React component tests cover no matches, clearing, case-insensitive name/location matches, upstream empty data, and whitespace. One test fails before; all five pass after. All 24 cumulative tests PASS. Actual deployed component tests 3/3 and bundle syntax PASS. Reversing the one production condition exactly recovers the prior bundle; other assets and previous repairs preserved.

Candidate asset index-6d3e6bafcf0c.js; SHA256 6d3e6bafcf0c7ede473c49ee521916a745fd2add0e6fde19fd5f96f6cd0626ec.
Prior deployment 3761ea17-03b2-4ce6-8023-e5268b66131e; rollback /home/openclaw/.cache/nudashboard-audit-20260910/ndash005-dist.

Production build, deployment and live verification recorded after execution. No records created or changed.
