# NDASH-121 — Supply report date-only values shift one day backward

Inventory / Clinical Supply / Reports. Medium.

Reproduced twice on live120 with April2026/Brick/Clinical Supply Fulfillment Spend by Office. Forty rows display March31(22) and April13(18). Read-only source query selecting only date_supplied confirms exactly40 records, April1(22) and April14(18). No names/amounts/identifiers retrieved, no data changes. All Offices has165 April records,108 displaying outside April before correction.

Root: SupplyReportsTab fmtDate creates new Date(v) for a YYYY-MM-DD value, interpreted at UTC midnight and shifted to the prior calendar day by local formatting. Minimal fix adds local-midnight suffix only to a strictly date-only string. Genuine timestamps retain their previous local conversion; empty/invalid readback unchanged. Fulfillment Records already displays raw date strings, so no unrelated formatters changed.

Six new tests (two fail before) cover NewYork/LosAngeles/UTC/Tokyo, timestamps, empty and invalid input. All546 frontend tests PASS. Build33.61s PASS. Rocket847 confirmed one-helper change. Actual artifact/deployment/live pending.

Actualcompiled formatter reproduces prior-day shift and passes all four timezones/timestamps/placeholders. Fullreverse120/sevenmodule relinksPASS. Candidateindex-f7571f2e6e63.js;deployment/livepending.
