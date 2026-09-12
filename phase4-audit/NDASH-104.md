# NDASH-104 — Unimplemented Custom Range silently runs fixed periods

Status: reproduced twice, repair preparing. Reports P&L/Barnegat: selecting Custom Range offers no date inputs, switches the P&L heading to Full Year2026, and labels top KPIs Selected Period without an unavailable notice. Switching to This Month correctly selects Sep2026; selecting Custom again reproduces the full-year fallback and absent date controls.

Root cause: ReportsDateFilter exposes custom as a normal selectable preset, but has no custom date entry. Parent/child report functions fall back to differing fixed ranges. Smallest safe fix: visibly label this option unavailable and disable it, preserving all supported presets. This repair does not implement custom reporting or alter financial queries/calculations. Record custom date reporting as an unavailable capability.

Tests/deployment/live verification pending.103 recovery retained.

Three focused rendering cases reproduce two failures before; all457testsPASS. Build35.52sPASS; Rocket830confirmscustomdisabled/unavailable andotherpresetspreserved. ActualcompiledrenderPASS: customdisabled/labeled, supportedpresetobjectsidentical, LastMonthselection/menucloseunchanged; fullreverse103/priorrepairs/7relinksPASS. Candidateindex-3e77d88753a1.js. Deployment/livepending. Custom date reporting remains unavailable, not implemented by this safeguard.

## Closure — PASS

Source commit 5f61f4b. Deployed through the existing path: bd84197f-8475-4741-99f9-a2857c203ba8, asset index-3e77d88753a1.js (SHA 3e77d88753a1ff74b843989e38d14ab2e45fd084ab48495c216f30c6cb2910b0). Recovery103 remains 4029a7a9-d115-4313-9947-48e4562a5ddc.

Live: Custom Range (unavailable) is disabled with disabled styling; Last Month selects Aug2026, This Month selects Sep2026, supported choices close the menu. Reload retains the disabled safeguard and new release. No new browser errors. Frontend product routes/API return200; all three services active; backend085 hash unchanged. No business data changes. Custom date reporting remains an unavailable capability.
