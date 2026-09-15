# PH5-SETTINGS-002 — Service-category status toggle

The isolated QA Service Categories screen created and edited one clearly labeled temporary category successfully. Deactivate then failed twice with `invalid input syntax for type uuid: "undefined"`; the record stayed Active and its two create/edit audit entries were unchanged.

Like the independently repaired cost-driver handler, this handler expected a row although `ManagementTable` supplies `(id, targetActive)`. The two-line correction passes those arguments to the existing service. No table, policy, financial calculation, authentication, or deployment configuration changes.

- Actual-handler regression: original 0/3 PASS; fixed covered by 1,336 retained PASS, zero skips.
- 510 source files match the QA build. QA environment and credential checks PASS.
- Candidate source `3b943a3d14d4b8c99d90d89faec6fd9ed1172e80`, entry `assets/index-CQHYZXbW.js`, 8,828,380 bytes, SHA256 `3dfba836b743e573bb1fa32425100b4cedc7d487165696db1f5a5929eab1b885`.
- Six ordinary-role API write denials PASS.
- QA deployment `0dbd298d-1cf5-446c-b843-e43156643dd6` succeeded; previous `fee7c52b-0022-43b5-b4d3-bc4bdcb27b5e` retained. All 17 hosted checks PASS; production unchanged.
- Original Deactivate action now persists Inactive after refresh, and Activate restores Active. Audit count rose from 2 to 3 to 4; one record remained. Delete cancellation retained Active; confirmed soft deletion produced Inactive and a fifth audit entry.
- Temporary service category removed after dependency checks. Original empty table restored, all five audit entries retained. Evidence: `qa-service-ui-20260915.json` and `qa-service-permissions-20260915.json` outside source control.

Adjacent vendor settings: one synthetic vendor created, edited, refreshed, filtered, soft-deactivated after cancellation test, and removed after dependency checks. Six ordinary-role denials PASS; all seven audit records retained. No duplicate record created. The vendor settings UI has no restore control; no real vendor transactions or financial postings performed. Evidence: `qa-vendor-ui-20260915.json` and `qa-vendor-permissions-20260915.json` outside source control.
