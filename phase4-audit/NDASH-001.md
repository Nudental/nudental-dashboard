# NDASH-001 — Executive Overview comparison direction

Reproduced live September 11, 2026, Last Month / August 2026 / All Locations, and again after refresh. Revenue reported +226.2%, while the net-production KPI reported -226.2%. Read-only API aggregates confirmed current net production 280649.43 and prior net production -222364.52.

The KPI's `yoyLabel` divided by the signed prior value, unlike the Revenue component. The single source-line repair divides by `Math.abs(p)` and retains zero-baseline behavior.

Validation: five source regression cases pass; recovered frontend production build passes. The exact saved production bundle was independently patched at its unique corresponding expression, parsed by Node, and its actual formatter passed five regression cases. Reversing the expression change reproduces every original bundle byte. All seven other asset files and the existing payroll date adjustment remain unchanged; index.html changes only the asset filename.

Baseline deployment: ee46d212-907a-4dcc-a632-fa46ac7154eb.
Baseline bundle SHA256: 2206eb45703381d04b020a1b5084006b9bf39c8aebae0527c341f70c59e920ae.
Candidate bundle SHA256: cfc9f63481e88692d0ae24b7d9b9fa881bb6b8b040cb4a4f9bbf61872affafe2.
Candidate directory: /home/openclaw/.cache/nudashboard-audit-20260910/ndash001-dist-v2.

Rocket contains the formatter repair, but downloaded exports still contain unrelated MonthlyGrowthTab property changes despite correction requests. Those changes and Rocket's generated historical recovery files are excluded from this source commit and the production candidate. Do not deploy the entire Rocket export. The recovered dependency lockfile is also incomplete; its local compile check is not an exact reproducible production build.

Deployment: Cloudflare Pages a997ce91-f82b-4220-946a-59106c11c4fb, success on September 11, 2026. Live verification PASS: the public domain loads the expected new asset, and August 2026 / All Locations shows +226.2% in both net-production comparisons. Net production $280,649, collections $264,130, and 194 new patients are unchanged. Existing production rollback artifact and owner-only source snapshot remain preserved. No business data was changed.
