# NDASH-130 — Financial subtab Apply silently drops additional offices

Severity: High. Status: CLOSED — deployed and live verified PASS.

On129, apply Barnegat+Brick / calendar2026 in Financial Analytics. Collections applied caption names both, but its local Office dropdown shows only Barnegat. Press Apply Filters without changing any control: after loading the applied caption changes to Barnegat alone. Repeated independently in Production & Adjustments: the same unchanged Apply drops Brick. No business write was involved.

Root cause: both local filter-state initializers/effects reduce appliedOffices to its first ID, and handleLocalApply serializes that scalar as a one-element array. A multiple-office selection has no corresponding option in the native subtab selector. Preserve the full applied selection when reapplying or changing dates; explicitly selecting an individual office or All Offices must still work.

Fix: in each component, initialize/synchronize the native local selection with all applied IDs joined by commas; provide a combined option labeled with the selected office names; split the selected value back to the complete array on Apply. Existing explicit single/All choices and date validation remain intact. Only12 added/6 replaced lines across ProductionAdjustmentsTab.jsx and CollectionsTab.jsx; no service, backend, data or configuration changes.

Tests:10 new focused tests PASS, all608 retained frontend tests PASS, build38.11s PASS, Rocket858 two-file repair/build PASS. Actual compiled initializer, applied-state synchronization, native combined option/value/label, and Apply expressions pass multi/single/all/empty fixtures in both components. Full reversal equals129, preserving all prior code and seven relinked modules. Candidate index-bf0c7e1cf193.js; deployment and live verification pending.

Deployment:71e5ee01-b8f3-45b0-b2ef-051d3eb8401c; source84aac70; index-bf0c7e1cf193.js SHA256 bf0c7e1cf193c6043a1979605f61df6e133bb6ea70e29306702a872d2db1a8b9. Prior129 deployment1711acfc-7a7e-49cc-b6ee-81fd06aa183b preserved.

Live PASS in both components: combined selector visibly reads Barnegat, Brick; unchanged Apply keeps both; changing only the date keeps both (Collections calendar2026 toJan1–Jun30; Production June30 toJune29 and back). Jan1–Jun30 production/adjustment/net and all three collections totals retain129's selected-pair source fingerprints. Explicit single Barnegat and All Offices selections work and match all six expected source fingerprints. Fresh errors0; frontend/API200; three services active; backend113 hash unchanged. All verification actions were read-only filters; no business/test records were changed or require cleanup. The separately scoped payment breakdown remains pending investigation.
