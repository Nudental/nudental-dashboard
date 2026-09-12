# NDASH-103 — Reversed comparison periods become false zero results

Status: reproduced in both periods, repair preparing. On102/Barnegat: Period A Jan30→Jan29 is accepted and yields a comparison caption with that reversed range and zero Net Production for A, without warnings. Repeat with valid A and Period B Mar1→Feb28: B is likewise accepted and shown as zero without warning. Read-only queries only; no business records changed.

Root cause: handleCompare runs both period queries without validating date presence or order. Smallest fix: validate both native date-input ranges before any request, clear stale results for invalid input, and show a dedicated validation message. Valid comparisons, queries, applied snapshots, metrics and permissions remain unchanged.

Tests, deployment and live verification pending.102 recovery retained.

Five focused cases reproduce four failures before; all454testsPASS after. Retained102callbacktest harness extended for the new validation setter. Build30.59sPASS; Rocket829confirmedvalidationbeforefetch anddedicatedrolealert. ActualcompiledtestsPASS: oldinvalidrequestsreproduced, reversed/incompleteAandBmakezeroqueries, oldresults/warningscleared, alertnamedperiod, validordered/samedayqueriesandsnapshotpreserved; fullreverse102/priorrepairs/7relinksPASS. Candidateindex-2e5667b8add1.js. Deployment/liveverificationpending.
