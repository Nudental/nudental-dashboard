# NDASH-099 — Older Task requests overwrite the selected office

Status: verification in progress. Severity: Medium.

Live on098: rapid Barnegat → All Offices → Brick left Brick selected with two completed tasks, three empty Kanban columns and Total2/Completed2 after loading ended. A later independent state check confirmed the mismatch persisted. Normal Brick selection returns zero tasks and four empty columns. Two further rapid trials settled correctly; this defect is timing-dependent. Six controlled delayed-response cases reproduce the exact source race; five fail before.

Root cause: TeamAssignmentsContent.loadTasks applies every overlapping row/count response and every catch/finally result. Both queries share unguarded state setters. Add a stable request generation ref, invalidate each prior generation at load start and effect cleanup, ignore obsolete responses after each awaited query, and guard error/loading setters. Keep all queries, role/office/filter scoping, count calculations, UI, business handlers and the098 outer permission gate unchanged.

All428 tests PASS after, including the098 permission lifecycle tests (mock extended with useRef). The final guard-placement adjustment separately passes all six request-order cases. Build/Rocket/compiled/deployment/live verification pending. Frontend098 rollback retained; no business data changed.

Build30.22sPASS;Rocket824confirmedallguards/cleanup/preserved098wrapper. Actualcompiledoldrace reproduced;fixedrows/counts/error/loading/currenterror/cleanupPASS;full098reversal/priorrepairs/7relinksPASS. Candidateindex-aa8abbfd03d7.js. Compiledpreparation accounted for existing optional-call expressions, !0 booleans and ternary scoping; only request-order additions. No failed candidate deployed. Deployment pending.


CLOSED PASS. Deployment22d320b2-2da4-4f94-9fe8-76d5d8234738/index-aa8abbfd03d7.js. FreshTasksbaseline2/no310;originalrapidBarnegat-All-Bricknow0/fouremptycolumns,independentsettledcheck0;rapidAll-Eat-Bar2/2CompletedrowsallBarnegat;stats2/0/0/2;Overdueempty;All+Kanbanrestored;finalreload2/nocrash/newerrors0. Root/Tasks/Insurance/API200/3services/backend085/worker093unchanged.098rollbackretained. No taskrecords or externalactionschanged.

