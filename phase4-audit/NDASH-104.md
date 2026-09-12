# NDASH-104 — Unimplemented Custom Range silently runs fixed periods

Status: reproduced twice, repair preparing. Reports P&L/Barnegat: selecting Custom Range offers no date inputs, switches the P&L heading to Full Year2026, and labels top KPIs Selected Period without an unavailable notice. Switching to This Month correctly selects Sep2026; selecting Custom again reproduces the full-year fallback and absent date controls.

Root cause: ReportsDateFilter exposes custom as a normal selectable preset, but has no custom date entry. Parent/child report functions fall back to differing fixed ranges. Smallest safe fix: visibly label this option unavailable and disable it, preserving all supported presets. This repair does not implement custom reporting or alter financial queries/calculations. Record custom date reporting as an unavailable capability.

Tests/deployment/live verification pending.103 recovery retained.

Three focused rendering cases reproduce two failures before; all457testsPASS. Build35.52sPASS; Rocket830confirmscustomdisabled/unavailable andotherpresetspreserved. ActualcompiledrenderPASS: customdisabled/labeled, supportedpresetobjectsidentical, LastMonthselection/menucloseunchanged; fullreverse103/priorrepairs/7relinksPASS. Candidateindex-3e77d88753a1.js. Deployment/livepending. Custom date reporting remains unavailable, not implemented by this safeguard.
