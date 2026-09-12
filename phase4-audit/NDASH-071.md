# NDASH-071 — Review filters compare display labels instead of canonical flags

Section: RCM Adjustment / Discount-Write-Off and Missing Documentation queues. Severity: Medium. Status: tested; deployment pending.

Reproduced on frontend069 after backend070: Large Adjustment and Late-Posted return zero in both queues. The current API has documentation counts192/18 and Discount-Write-Off counts185/20 for those canonical flags. Display labels include qualifiers: Large Adjustment (>= $500), Late-Posted (> 7 days).

Root cause: both local filter predicates prefer human-readable labels over the provided stable flag codes. Lowercasing and replacing whitespace/hyphens retains the threshold suffix and cannot match the selected canonical key.

Smallest fix: swap precedence in exactly two const flags expressions in AdjustmentTab.jsx. DiscountWriteOffPanel uses review_flags before review_flag_labels; DocumentationQueuePanel uses triggered_flags before triggered_flag_labels. Existing fallbacks and all display labels are preserved. No review thresholds, amounts, categories, data, backend or approval logic change.

Tests: after correcting the harness to recognize optional-call AST nodes, 6 actual-source regressions fail before and all10 pass after, covering qualified labels, unrelated flags, legacy labels and explicit empty canonical lists. Full315 frontend tests pass; production source build37.90s PASS. Actual compiled filter predicates1269/1134bytes have the same before/after behavior. Full reversal to069, prior repairs, seven dependency relinks, and parser checks PASS. Rocket799 matches the two changes. Blocked042/066 remain excluded; the whole recovered frontend is not released.

Candidate asset index-95ef528758a8.js, based on a39ed8d3-7637-45dd-a10f-a09999c3044b. Backend070 SHA dec9768c7d981725d965c1c0fff6f47de8ec8c10ca41fd2ef14a80434a6a0f4a must remain unchanged. Verify each queue against its own API counts, clear/reset, existing notes and full reload after deployment.
