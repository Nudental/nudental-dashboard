# NDASH-100 — EOD API-synced list silently stops at1000 records

Status: reproduced, source repair pending. Severity: High (incomplete provider groups/collection totals).

Live Dentrix API Synced card10544; clean search/all offices view renders1000 provider records in295 office/date groups, no pagination. Refresh reproduces the same cap. Manual views reconcile Pending0/Approved1/Rejected1/Reapproval1; approved audit history3events renders and closes. No approval/edit/rejection/submission actions executed.

Root cause: fetchEntries awaits a single Supabase select without ranges, whereas the card uses an uncapped exact count. Local search and grouped provider collection sums see only the first1000 records. The original query's submitted_at ordering also needs id as a stable secondary order for paginated retrieval.

Planned targeted repair: complete bounded/ranged reads with exact-count and duplicate/incomplete checks, stable ordering and obsolete-request cancellation. Display a limited number of complete office/date groups per page rather than rendering all10000+ rows; preserve grouping math. Retain manual entries and restrict select-all to the visible manual page, clearing selection when its scope/page changes. Keep all approval/business handlers and permissions unchanged. Validate before deployment; do not claim completion now.

Source implemented: complete bounded reads, request guards, complete-group pagination, visible-only selection, and search/scope reset. All440 source tests PASS; production build26.17s PASS. Rocket825/826 confirms scoped implementation and raw-entry footer count. Actual compiled tests PASS: old1000 cap reproduced versus10544 complete, query projection/scoping/order, partial/count drift/duplicate rejection, stale row/count/error/loading guards, complete group totals/no omissions, actual component render and page controls, selection/reset. All existing business handlers byte-identical; full reversal to099 and prior repairs/7dependency relinks PASS. Candidateindex-11a65abd8b58.js, not yet deployed. Test collector initially skipped nested mapped arrays; corrected test traversal, candidate unchanged.
