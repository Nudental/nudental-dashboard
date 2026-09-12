# NDASH-102 — Comparison form edits relabel old financial results

Status: reproduced twice, repair preparing. On101, complete All Offices comparison Jan1–Jan31 versus Feb1–Feb28. Change Period A end to Jan30 without Compare: result caption changes to Jan30 while all14 table rows retain the exact prior fingerprint. Change again to Jan29: same mismatch. No financial records changed; only date inputs edited.

Root cause: result caption reads mutable form periodA/periodB/effectiveOfficeFilter, while comparisonData contains only the previously fetched metrics. Smallest fix: retain the applied dates and office alongside each completed result and render its caption from that snapshot. Keep old results correctly labeled while editing; Compare still explicitly runs queries. Do not alter requests, metrics, permissions, controls or source data.

Verification and deployment pending.101 recovery preserved.

Fivefocusedcases/fourfailbefore; all449testsPASS after. Build30.71sPASS;Rocket828confirmedappliedperiod/office snapshotsandcaption-onlyreadback. ActualcompiledtestsPASS: oldcaptionmismatch, copieddates, formdate/officechangesdon'trelabelresults, explicitnewcompareupdatessnapshot, unchangedqueries/metrics, fullreverse101/priorrepairs/7relinks. Candidateindex-7ff6be33baac.js. Deployment/livepending.

CLOSED PASS. Deployment f8f7cfa0-8e07-4339-84da-93ecc087123a, asset index-7ff6be33baac.js. Live Jan31 comparison retained its original caption and all14 row values when the form end changed to Jan30 and then Jan29. Explicit Compare produced the Jan29 caption and completed results. Selecting Barnegat retained the prior All Offices result caption and values until Compare; the completed new comparison correctly shows Office: Barnegat. Both new comparisons returned14 rows without source warnings. No new browser errors. Root/Reports/EOD/Tasks/Insurance/API200 and all three services healthy; backend085 and Worker093 unchanged.101 recovery retained. No business records changed. One browser wait timed out while the query continued; a subsequent state check verified successful completion.
