# NDASH-106 — Combined Reports summaries remain at the first office

Section: Reports / top KPIs and Production & Collections panels. Severity: High.

Reproduced on live105, August2026: Barnegat single-office summary/cards load. Add Brick: filter shows2 Offices and the provider report correctly updates (105), but the production/collection panels remain byte-identical to Barnegat. Net Production, Total Collections and Est.Net Profit cards become unavailable and stay that way after the expense request completes. Returning to Barnegat does not refetch the unchanged first-office panel; blank cards persist. No financial/business records changed during reproduction.

Root cause: Reports passes locationIdProp while ProductionCollectionsPanel accepts locationId, so the panel falls back to the first officeId. Combined selection is absent from its request dependencies. Parent reset depends on the single-location/null conversion, leaving cards blank without a corresponding fresh panel result. The existing effect also lacks cancellation before publishing results/calling parent setters.

Fix: only Reports/index.jsx and ProductionCollectionsPanel.jsx. Reports resolves/deduplicates a full location list, passes the correct prop and list, and resets cards for the full scope. The optional monthly list requests the existing production/collection endpoints for each selected location; sums the six current fields with missing amounts remaining unavailable; unknown IDs fail before requests. Legacy single/all/daily paths remain. Existing effect cleanup cancels obsolete results including parent callbacks; changed requests clear old detail data. No infrastructure/config/API/business changes.

Nine focused cases (first seven6fail/1pass before). All473 frontend regressionsPASS; source production buildPASS34.49s. Rocket832 requested. Compiled candidate and live deployment/verification pending;105 recovery retained.
Rocket832 confirms two scoped files. Actual compiled combined summaries and parent liftPASS; single/all/daily final paths identical; invalid/partial/obsolete results guarded; effect cleanup and unchanged renderingPASS. Complete reversal105/prior repairs/7relinksPASS. Candidateindex-845e42766a6b.js. Deployment/live pending.
