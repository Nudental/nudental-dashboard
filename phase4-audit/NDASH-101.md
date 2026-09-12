# NDASH-101 — Reports comparison drops the selected office

Status: reproduced twice, repair preparing. Reports top office control Barnegat, Period Comparison internal office selector All Offices, successful result caption All Offices. Switching away and remounting Period Comparison reproduces the mismatch with parent Barnegat retained. No business data writes.

Root cause: reports/index.jsx passes officeFilterProp={scopedOfficeFilter}, but PeriodComparisonView destructures officeFilter: officeFilterProp. The prop is therefore undefined and the child defaults to all offices. Smallest fix: rename only that JSX prop to officeFilter. Preserve the child, requests/calculations/permissions and all other controls unchanged. Multi-office behavior is not changed by this repair.

Verification/deployment/live result pending; frontend100 recovery preserved.

Four focused cases reproduce three failures before; all444 tests PASS after. Build30.40sPASS; Rocket827 exact one-prop confirmation. Actual compiled prop binding tests PASS; child byte-identical, full reversal to100 and all prior repairs/7dependency relinks PASS. Candidateindex-e1922580a053.js. Deployment/live verification pending.
