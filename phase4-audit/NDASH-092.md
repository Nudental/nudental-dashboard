# NDASH-092 — Analytics office rows all have the same generic label

Section: Huddle Analytics. Status: source fixed, deployment verification pending.

Reproduced after091closure: Barnegat collections chart shows Office; All Offices shows four rows each labeled Office, persisting after Refresh. MTDCollectionsChart reads h.offices.name, but getHuddlesForAnalytics omits the existing offices(name) relation. Other Huddle History queries already use that relation.

Smallest fix: add offices(name) only to the Analytics read projection in src/services/huddleService.js. No chart formulas, dates, filters, ordering, nested provider/checklist data, permissions, configuration or business data changed.

Five service/chart contract tests cover distinct names, exact filters/order, retained nested data, empty results and errors. One failed before; all400 frontend tests pass after. Build/Rocket/compiled/live verification pending.

Build24.77s/Rocketexactqueryconfirmation/actualcompiledprojectionfiltersrelationsorderemptyerror/full091reversal/7relinks PASS. Prior091datehelper/090requestguards/089and088code preserved. Candidateindex-8f5e9926e508.js; no payroll code changes.

CLOSED PASS. Deploymentc436e026-f78a-478f-8c12-4cd8e796eba4/index-8f5e9926e508.js. InitialBarnegatlabel/25huddles;AllOffices100withfourdistinctnamesBarnegat,Brick,Eatontown,StatenIsland;Refreshpreservesnames/counts;rapidStaten-All-BarsettlesBarnegat25;errors0. Frontend/API200/three servicesactive/backend085unchanged.091rollbackretained. No business writes.
