# NDASH-140 — Revenue Breakdown labels All-office totals as one selected office

Severity: High. Status: reproduced; repair under verification.

Repeated live139 Jan1-Jun30,2026 Barnegat+Brick: Revenue Breakdown displays All netf3439488/collections832fcb70 and a single Office Breakdown row labeled Barnegat with those same All totals. Adjacent repaired Statistical Summary correctly shows the selected pair. Independent source comparisons confirm the mismatch. Original test repeated via Apply before editing.

Root cause: primary financial/filter-options calls use null for multiple offices, while the office table treats every non-All selection as a single office and names its first item. Fix in RevenueBreakdownTab.jsx: reuse the verified selected-office financial reader for both summaries, pass deduplicated location IDs to the existing multi-location filter-options API, query office rows only for selected offices (or all when All selected), and reject invalid IDs before requests. Preserve formulas, All/single behavior, existing response handling and all other views. No backend/configuration/business-data changes.

Verification: 693 frontend tests PASS (eight new scope cases); production build PASS in 38.65 seconds. Rocket version869 complete. Scoped release changes only the location initializer and revenue callback plus seven dependent-module relinks. Exact compiled All/single/pair/duplicate/invalid-office/date checks PASS; complete reversal equals live139 and all seven prior modules are preserved. Deployment/live verification pending. Existing catch-to-null availability behavior is a separate follow-up, not claimed repaired here.
