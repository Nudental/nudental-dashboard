# NDASH-154 — Marketing credit field readback

Status: candidate verified; publication and live verification pending.

Severity: Medium — the Marketing credit breakdown treats a known provider field as missing.

Reproduction: unchanged backend148 Marketing aggregate for August exposes creditAdjustments for all four offices, each with confirmed zero. Live All Offices shows a missing dash in every Credit Adj. cell; switching to single Barnegat repeats the missing value. No business records were changed to create this case.

Root cause: the reader accepts creditAdjustment (singular), credit_adj, credit_adjustment, creditAdj and credits, but omits the actual provider field creditAdjustments.

Small fix: add the plural field immediately after the existing singular field in the nullish fallback chain. Keep legacy precedence, unknown values, explicit backend totals, and NDASH-153 selected-office filtering unchanged.

Eight focused tests PASS, four fail against the preceding source. Complete frontend suite 811 PASS; production build PASS (34.18 seconds). Signed/zero/string credits, legacy aliases, unknown fields, fallback component arithmetic and no double adjustment of explicit totals are covered with immutable synthetic fixtures. Rocket completed version 884. Negative-credit fixtures are synthetic; no production financial records were created or altered.

Only operationsService.js changes. No backend, authentication, configuration, infrastructure or business-data changes. Publication excludes blocked NDASH-042 and NDASH-066. Exact artifact and live results follow below.
