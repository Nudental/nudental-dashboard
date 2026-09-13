# NDASH-114 — Healthy and Manual Only Sync filters hide matching jobs

Twice reproduced after113live: Healthy0 despite Jobs Healthy6; ManualOnly0 despite existing configured manual job count1. Root: filteredJobs only compares selected label enum to literal status/freshness. Healthy is successful+fresh and manual-only is a configuration flag, independent of last run status.

Small source change only in SyncDashboard filteredJobs predicate: add successful/completed+fresh predicate for healthy and strict is_manual_only true predicate for manual_only, preserving all existing source/literal status/freshness matching. No actions/API/backend/config/data changes.

Sevenfocused tests3failbefore/all519regressionsPASS; productionbuild34.05sPASS. Rocket confirmed same predicate-only change; no versionnumber stated. Actualcompiled filter old0/0 reproduced, corrected/legacy/source/unknown casesPASS. Complete reversal to112 and seven dependent module relinks prove prior release code preserved, including payroll and all earlier repairs. Candidateindex-0d02a047680d.js. Deployment/livepending;backend113 unchanged.
