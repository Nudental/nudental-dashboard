# NDASH-098 — Tasks crashes when permissions finish loading

Status: verification in progress. Severity: High.

Two fresh direct/reload attempts at /team-assignments show Something went wrong and React310. React's official decoder identifies this as more hooks than during the previous render (https://react.dev/errors/310).

Exact root cause: TeamAssignments returns during RBAC loading/denial before later useEffect/useCallback/useRealtimeSubscription hooks. Resolving access changes its hook order. Keep the same permission check in a small outer TeamAssignments component and mount the existing TeamAssignmentsContent only after access is resolved and allowed. Task-content hooks, queries, role/office scoping, subscriptions, UI and business handlers are unchanged. This does not change authentication architecture or permissions; it preserves the preexisting boundary against denied/loading data reads.

Three synthetic lifecycle tests fail before: loading-to-allowed, denied-to-allowed, allowed-to-loading. All422 retained tests PASS after; tests also assert no task reads/subscriptions during loading or denial, and no business mutations. Build/Rocket/compiled/deployment/live verification pending. Frontend097 rollback retained; worker093/backend085 unchanged.

Build27.39sPASS;Rocket823confirmedboundary/content-onlychange;compiledloading/denied/allowedgateandunchangedcontenthandlers/queries/full097reversal/priorrepairs/7relinksPASS. Candidateindex-62bb28817059.js. Deployment pending.


CLOSED PASS. Deployment599761c0-1e5f-4def-acac-516703e53833/index-62bb28817059.js. TwofreshloadsnowTeamAssignments/nocrash;settledTotal2/Completed2/InProgress0/Overdue0;Table2Completedrows/Completedfilter2/Overdueempty/Kanbanrestored. Freshreloadtimestampfilternewerrors0 (4prior310logentriespersistacrossreloadandarepre-fix). Root/Tasks/Insurance/API200/3services/backend085/worker093unchanged;097rollbackretained. Serverfree12.11GiB. No taskrecordsmodified. AdditionalblankNewTaskvalidationdescription+dateerrors/Cancel/baseline2PASS.

