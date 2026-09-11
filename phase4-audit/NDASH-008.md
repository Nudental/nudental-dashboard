# NDASH-008 — Total A/R aging percentage uses insurance denominator

Section: Operations / Claims / AR. Severity: High.
Repeated live reproduction (including Refresh): Over 90 Days is $205,147.26, Total A/R $541,342.52, insurance portion $244,872.43. The card reports 83.8% of total, incorrectly dividing total aging by only insurance balances. Expected 37.9%.

Root cause: ARAgingTab.jsx computes pct90 with totalInsuranceAR instead of totalBalance. Fix changes that single argument and its explanatory comment. Dollar values and business records are unchanged.

Rocket Version 742 reports the same one-file change. Five synthetic regression cases cover the real example, insurance-mix independence, unavailable/zero denominator and real zero aging; baseline fails four and candidate passes five. All 29 retained frontend regressions pass. Production source build passes (34.20 seconds; existing chunk-size warning).

The deployed-artifact candidate changes only the uniquely matched expression k=R8t(j,A) to k=R8t(j,T). Tests validate the actual minified function and the source of its variables. Five artifact assertions and JavaScript syntax pass. Reverse-patching reproduces the previous artifact exactly; all other files remain unchanged apart from the index.html asset reference.

Previous asset SHA256: 6d3e6bafcf0c7ede473c49ee521916a745fd2add0e6fde19fd5f96f6cd0626ec.
Candidate asset SHA256: d24473609d7eb85e501107d2c18f0e801e8cee07f05104673ecca74077675fd6.
Deployment/live verification pending at this commit.
