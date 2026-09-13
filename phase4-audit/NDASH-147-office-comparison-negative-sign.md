# NDASH-147 — Year comparison drops minus signs from counts and percentages

Severity: Medium. Status: reproduced and tested; deployment/live verification pending.

Live146 Operations > Offices, Last Month / All Locations: compare displayed Default and Last Year rows, then Diff Last Year. Declines in Collection % for Barnegat, Eatontown and Staten Island, and New Patients for Brick, display positive numbers. Switching Default→Diff repeats all four sign mismatches. Only local view controls were used; private rendered values were compared without logging amounts.

Root cause: formatCellValue formats Math.abs(val), then restores negative signs by replacing the dollar character. Percentage and count formatters contain no dollar character, so their minus sign is lost. The two-line fix prefixes the correct sign independently, followed by the absolute formatted value. Existing negative/positive currency behavior, positive percentages/counts, zero, unavailable values, fallback formatting, Default/Last Year, percentage-change mode, arithmetic and colors are preserved.

Eight actual-source formatter cases: two failures before editing, six controls PASS. All753 frontend tests PASS after the fix; production build32.31s PASS. Actual compiled formatter cases and full reverse146/prior modules/syntax PASS; one scoped formatter plus seven dependency relinks. Rocket876 completed the matching one-file change and successful build. No business data, API, backend, provider, authorization or configuration changes; no test records or exports.
