# NDASH-010 — Actual production mislabeled as scheduled production

Section: Operations / Performance. Severity: Medium.
Reproduced twice: August table “Scheduled vs Open Breakdown” / “Scheduled Prod” displays Barnegat $104,505, Brick $72,424, Eatontown $94,198, Staten Island $9,521. These values are actual net production, as independently verified against the production summary.

Root cause: PerformanceTab maps netProduction into an old field called scheduled_production, while retaining obsolete scheduled-production display labels. Fix changes only the visible heading to “Office Production & Activity”, the column to “Net Production”, and adjacent comments. No data fields, calculations, API requests, goals or other columns change.

Verification: all 36 retained frontend regressions PASS; production source build PASS (34.92 seconds, existing chunk-size warning). Actual artifact patch uses two unique component-specific anchors; reverse patch is byte-identical to the previous release and JavaScript syntax passes. No new implementation-mirroring tests were added for these two label edits.

Candidate asset SHA256 06524b06797d592c6e9122bef0633d354b40959bfb78b6361bc0c2643b376e50. Prior asset SHA256 07313e91ca8a3e688019744a7137789c023f4ac78e8d7644c8a48254d85d86c7.

Deployment: PASS, Cloudflare Pages a567c2f8-c1ec-4863-88de-cc0b5bc19c97. Rocket Version 744 reports the same one-file change. Live verification PASS on /operations?audit=ndash010: “Office Production & Activity” and “Net Production” appear with the same four office dollar amounts and patient counts. No backend, configuration or business-data changes.
