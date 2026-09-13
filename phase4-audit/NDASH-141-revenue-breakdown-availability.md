# NDASH-141 — Failed Revenue Breakdown reads appear as verified zeroes

Severity: High. Status: reproduced; targeted fix under verification.

Exact released140 callback tested with healthy controls and rejected production, collections, metadata, one-office and full-failure responses. Every failed case left error=null; primary failures set data=null, and failed office reads became zero rows. The released render defaults missing values to zero and shows Verified badges. Healthy live140 All/single/pair totals were independently verified immediately before this reproduction. No live outage or business writes induced.

Root cause: five catch-to-null handlers, missing finite core-field validation, and office allSettled filtering suppress source failures. An error banner also leaves successful-looking metrics visible below it.

Small one-component fix: propagate rejected reads; validate complete financial fields and existing aliases; require the existing metadata arrays; require every selected office response to succeed; clear stale data on failure; return the error alert before metrics and Verified badges. Preserve verified zeroes, signed values, dates, selected-office scope and formulas. Backend/configuration remain unchanged.

Verification: 703 frontend tests PASS (ten new availability/render/recovery cases). Production build PASS in34.19s; Rocket870 complete. Exact compiled healthy/production-failure/collection-failure/metadata-failure/one-office-failure/malformed/full-failure checks PASS; actual error render has role=alert and no Verified metrics. Three scoped regions plus seven dependency relinks; full reversal equals live140, all seven prior modules preserved, JavaScript syntax PASS. Deployment/live verification pending. Controlled failure tests do not claim a real production outage was exercised.
