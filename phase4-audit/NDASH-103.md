# NDASH-103 — Reversed comparison periods become false zero results

Status: reproduced in both periods, repair preparing. On102/Barnegat: Period A Jan30→Jan29 is accepted and yields a comparison caption with that reversed range and zero Net Production for A, without warnings. Repeat with valid A and Period B Mar1→Feb28: B is likewise accepted and shown as zero without warning. Read-only queries only; no business records changed.

Root cause: handleCompare runs both period queries without validating date presence or order. Smallest fix: validate both native date-input ranges before any request, clear stale results for invalid input, and show a dedicated validation message. Valid comparisons, queries, applied snapshots, metrics and permissions remain unchanged.

Tests, deployment and live verification pending.102 recovery retained.

Five focused cases reproduce four failures before; all454testsPASS after. Retained102callbacktest harness extended for the new validation setter. Build30.59sPASS; Rocket829confirmedvalidationbeforefetch anddedicatedrolealert. ActualcompiledtestsPASS: oldinvalidrequestsreproduced, reversed/incompleteAandBmakezeroqueries, oldresults/warningscleared, alertnamedperiod, validordered/samedayqueriesandsnapshotpreserved; fullreverse102/priorrepairs/7relinksPASS. Candidateindex-2e5667b8add1.js. Deployment/liveverificationpending.

CLOSED PASS. Deployment4029a7a9-d115-4313-9947-48e4562a5ddc/index-2e5667b8add1.js. Live reversed Period A and Period B each show the correct named validation message, no comparison results, and no loading state. Clearing the first date through native keyboard input correctly reports Period A. Initial fill-empty changed only DOM/tracker; restoring then keyboard clearing verified the actual input event, not a new app defect. ValidJan1-Jan29vsFeb1-Feb28/Barnegat clears validation, returns14 rows/no source warnings and correct saved caption; financial table fingerprint matches the prior valid102 result. New browser errors0. Root/Reports/EOD/Tasks/Insurance/API200/three services/backend085unchanged;Worker093unchanged.102 recovery retained. No business records changed.
