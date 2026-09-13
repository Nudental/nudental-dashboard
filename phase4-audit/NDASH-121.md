# NDASH-121 — Supply report date-only values shift one day backward

Inventory / Clinical Supply / Reports. Medium.

Reproduced twice on live120 with April2026/Brick/Clinical Supply Fulfillment Spend by Office. Forty rows display March31(22) and April13(18). Read-only source query selecting only date_supplied confirms exactly40 records, April1(22) and April14(18). No names/amounts/identifiers retrieved, no data changes. All Offices has165 April records,108 displaying outside April before correction.

Root: SupplyReportsTab fmtDate creates new Date(v) for a YYYY-MM-DD value, interpreted at UTC midnight and shifted to the prior calendar day by local formatting. Minimal fix adds local-midnight suffix only to a strictly date-only string. Genuine timestamps retain their previous local conversion; empty/invalid readback unchanged. Fulfillment Records already displays raw date strings, so no unrelated formatters changed.

Six new tests (two fail before) cover NewYork/LosAngeles/UTC/Tokyo, timestamps, empty and invalid input. All546 frontend tests PASS. Build33.61s PASS. Rocket847 confirmed one-helper change. Actual artifact/deployment/live pending.

Actualcompiled formatter reproduces prior-day shift and passes all four timezones/timestamps/placeholders. Fullreverse120/sevenmodule relinksPASS. Candidateindex-f7571f2e6e63.js;deployment/livepending.

CLOSED PASS: sourcee61b594/deployment6d9df158-3bfd-4e6c-b95c-e6dcb8fd6e9c/index-f7571f2e6e63.js SHA f7571f2e6e6392bd6512473d131025eb1b9e626a11fdb31a6efa711705fc20e2. FreshliveBrick40 datesApril1(22)/April14(18) exactlymatchsource;All165/outsideApril0. Newerrors0/frontendAPI200/three services/backend113unchanged. During rapid initial month changes plus report selection, AprilAll temporarily settled empty until localOfficechanged, suggesting a separate stale-request race; not part of121 formatterfix, investigate independently. No businessrecords changed.
