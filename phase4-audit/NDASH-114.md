# NDASH-114 — Healthy and Manual Only Sync filters hide matching jobs

Twice reproduced after113live: Healthy0 despite Jobs Healthy6; ManualOnly0 despite existing configured manual job count1. Root: filteredJobs only compares selected label enum to literal status/freshness. Healthy is successful+fresh and manual-only is a configuration flag, independent of last run status.

Small source change only in SyncDashboard filteredJobs predicate: add successful/completed+fresh predicate for healthy and strict is_manual_only true predicate for manual_only, preserving all existing source/literal status/freshness matching. No actions/API/backend/config/data changes.

Sevenfocused tests3failbefore/all519regressionsPASS; productionbuild34.05sPASS. Rocket confirmed same predicate-only change; no versionnumber stated. Actualcompiled filter old0/0 reproduced, corrected/legacy/source/unknown casesPASS. Complete reversal to112 and seven dependent module relinks prove prior release code preserved, including payroll and all earlier repairs. Candidateindex-0d02a047680d.js. Deployment/livepending;backend113 unchanged.

CLOSED PASS: sourced5f0628/deployment63b3d4d1-4e2a-4c58-b429-49380a063699/assetindex-0d02a047680d.js SHA0d02a047680d6478ccecf6b6fe13a9f24852fc9044334b4f0f9bbe87e07c2f40. FreshliveHealthy6 equalscounter andallSuccess/Fresh;ManualOnly1 retainsactualuninstrumentedstatus;ManualOnly+gusto0/All+gusto2/Success14. RefreshHealthy6 persists. Jobs29/endpoints10 retained;AuditTrail1122261/91pages/25rows preserved;newerrors0/frontendAPI200/3services/backend113unchanged PASS.112 recovery retained. No business/testrecords created.
