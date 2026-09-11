# Phase 4 source and deployment provenance

This branch belongs to the existing `Nudental/nudental-dashboard` repository. Its original root application and original main commit are preserved. The current editable Rocket frontend is isolated under `recovered-frontend/`; it is not asserted to be a byte-identical source baseline for production.

Original GitHub main: `e4a2e0944f74514f6ea98e5ea32eb140333b964f`.

The original Rocket export was downloaded September 11, 2026. Archive SHA256: `adba3c0fdb8568bdfd4ce9cb5d1c01e9640054b50359a235a2a472ad959c4ef4`. Environment files were excluded from this checkout. The accompanying manifest verifies each retained source file. Rocket's reported history includes September 8 payroll changes that are absent from the September 4 production artifact; its generated historical recovery manifest was internally inconsistent and is not trusted as an exact baseline.

Production uses a direct Cloudflare Pages upload to `nudashboard`, deployment `ee46d212-907a-4dcc-a632-fa46ac7154eb`. Bundle `/assets/index-2206eb457033.js` has SHA256 `2206eb45703381d04b020a1b5084006b9bf39c8aebae0527c341f70c59e920ae` and exactly matches the saved server artifact. Relative to the earlier saved bundle, production contains a one-day payroll request-date adjustment plus explanatory text. Those changes must survive every repair.

The complete production artifact and middleware source/configuration are retained in the owner-only server snapshot `/home/openclaw/.cache/nudashboard-audit-20260910/baseline-20260910T123502Z`. Private configuration and compiled assets containing runtime values must not be committed here.

Do not deploy this repository's root app or the whole recovered frontend over production. Release only reviewed repairs after proving their effect against the preserved production artifact, retaining rollback and live verification. No production deployment has occurred in Phase 4 at this checkpoint.

The existing GitHub repository is public. This local audit branch is not authorization to publish private runtime configuration or recovered backend credentials.
