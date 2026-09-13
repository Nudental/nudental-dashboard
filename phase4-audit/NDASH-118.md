# NDASH-118 — Catalog parent search hides matching children

Inventory / Clinical Supply / Supply Catalog, desktop. Medium.

Live117 reproduction before editing: Hygiene has three subsections, but searching Hygiene shows zero subsections and expanding shows No subsections. Clearing restores three. Prophylaxis has thirteen items; searching its subsection name shows zero items and expanding shows No items in this subsection. Repeating Hygiene reproduces again. No record changes.

Root cause: getSubsForDept filters only subsection/item names, even when the department matches; getItemsForSub filters only item names, even when a parent matches. Two-helper correction: a matching parent keeps existing children visible. Existing category-filtered item set is preserved, so a matching parent never bypasses the Front Desk/Back Staff restriction. No mobile, query, write handler, or configuration changes.

Five focused regressions: three fail before, all pass after. All533 retained/new frontend tests PASS. Production build34.30s PASS. Rocket844 confirms the two-helper repair. Scoped current-live artifact checks/deployment/live verification pending.

Actual deployed helpers reproduce both failures; repaired helpers pass parent/case/item/category/no-match/clear fixtures. Full reverse117 and seven dependency relinks PASS. Tooling distinguishes desktop/mobile copies and the optimized positive conditional return; application changes stay limited to the two desktop search helpers. Candidateindex-239ef530b1b2.js.
