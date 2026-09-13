# NDASH-154 — Marketing credit field readback

Status: CLOSED — deployed and live-verified PASS.

Severity: Medium — the Marketing credit breakdown treats a known provider field as missing.

Reproduction: unchanged backend148 Marketing aggregate for August exposes creditAdjustments for all four offices, each with confirmed zero. Live All Offices shows a missing dash in every Credit Adj. cell; switching to single Barnegat repeats the missing value. No business records were changed to create this case.

Root cause: the reader accepts creditAdjustment (singular), credit_adj, credit_adjustment, creditAdj and credits, but omits the actual provider field creditAdjustments.

Small fix: add the plural field immediately after the existing singular field in the nullish fallback chain. Keep legacy precedence, unknown values, explicit backend totals, and NDASH-153 selected-office filtering unchanged.

Eight focused tests PASS, four fail against the preceding source. Complete frontend suite 811 PASS; production build PASS (34.18 seconds). Signed/zero/string credits, legacy aliases, unknown fields, fallback component arithmetic and no double adjustment of explicit totals are covered with immutable synthetic fixtures. Rocket completed version 884. Negative-credit fixtures are synthetic; no production financial records were created or altered.

Only operationsService.js changes. No backend, authentication, configuration, infrastructure or business-data changes. Publication excludes blocked NDASH-042 and NDASH-066. Exact artifact and live results follow below.

Release: source 0ec9166; deployment 03dd5da1-3882-47ec-adba-c022bb5ca3ce; entry `/assets/index-48c3c39c521f.js`; SHA-256 48c3c39c521ff3d70b4a4a4d7f3c020542cc3f944dbf453ee0c777bb84d3dbcb (21740059 bytes). Compiled credit argument cases, canonical reversal of that argument, full reversal to NDASH-153 and seven dependent modules PASS. Exact live artifact, backend148 hashes, frontend/API and three services PASS.

Live PASS: August All Offices now shows $0 credits for all four offices, matching the known source. Single Barnegat also shows $0. Every other column is unchanged (Barnegat c8e548c3, Brick c326cc86, Eatontown f06c84f1, Staten Island 8394626f), as are all headline KPIs. Barnegat/Brick still produces only two rows and the three source KPI fingerprints 6ada52f4 / 67361333 / 527ccbc5. All Locations restored; zero new browser errors. Live positive/negative credit fixtures were not created in production; signed handling is covered synthetically.
