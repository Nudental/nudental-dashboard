# NDASH-152 — Provider detail selection and report scope

Status: candidate verified; deployment and live verification pending.

Severity: Medium — office-specific provider detail can be cross-selected or retained after its office is excluded.

Reproduction: Operations / Providers / Last Month / Barnegat + Brick returns 15 rows, including three pairs of same-name providers with distinct office contexts. Twice, selecting row 7 (Brick) highlighted both rows 7 and 9 (Barnegat); clicking row 9 closed the detail instead of switching it. Selecting Brick's detail and then filtering to Barnegat left that excluded-office detail visible beside the new nine-row report.

Root cause: all three desktop/mobile selection checks compared providerName rather than the actual mapped record. The report loader also retained selectedProvider across a new office/date read.

Small fix: compare the selected row object with the actual mapped record in the three selection checks. Clear selectedProvider at the start of a valid report load. Source mapping, dates, office request scope, calculations, missing-value handling, search and sorting remain unchanged.

Changed component: ProvidersTab.jsx only. Eight focused tests PASS; four fail on the preceding source. Complete frontend suite 795 PASS; production build PASS (33.33 seconds). Rocket completed version 882. Release artifact verification and live results follow below.

Safety: no backend, authentication, infrastructure, configuration, provider-record or business-data changes. Synthetic row fixtures are local only. Backend remains NDASH-148; blocked NDASH-042 and NDASH-066 remain excluded. Unsupported provider-detail charts keep their existing mapping-required messages.
