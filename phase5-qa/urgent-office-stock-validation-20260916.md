# Urgent request on-hand quantity by office

PH5-SUPPLY-022 — deployed and live verified in isolated QA.

With QA / Office A selected, choosing the existing QA TEMP Clinical Item 20260916 fills On Hand: 0, although the inventory UI and bounded database read both show six units. Switching to Office B and back to Office A repeats the zero. The form was canceled without saving either time.

Root cause: master search only loads `supply_items` catalog records, which have no office quantity. Its missing quantity becomes zero; changing office never reads `office_supply_inventory`.

The small repair adds an optional exact-item filter to the existing inventory service and reads stock when a catalog item and office are selected in the form. Empty authorized office inventory means zero; duplicate, malformed or failed reads leave quantity unknown and request manual entry. A pending lookup disables submission and quantity editing. Canceled/stale responses cannot overwrite newer selections. Custom-item manual entry, request metadata and existing inventory caching remain unchanged. No data/schema/policy/configuration changes.

Nineteen focused frontend tests pass: actual stock, empty office, stale response, failed/malformed/duplicate reads, custom/manual entry, missing office, inactive form, pending/invalid quantity submission, explicit zero, exact query filters and preserved cache behavior. All 1,580 retained frontend tests pass without skips; QA build, all 511 source-file comparisons and 17 hosted isolation checks pass.

QA deployment `a00da932-5961-498b-86a5-d9382a294be7` uses source `4990e5af03a5a7bfb584618997073240456b3d35`. The original Office A six / Office B zero / return-to-A six test passes live. Manual seven and cancellation pass; full refresh reselects six. One labeled synthetic request saved the six-unit quantity and one creation audit; refresh preserves the exact record and audit with no duplicate. Underlying stock remains six. UI request and unacknowledged counters both become one. Notification execution remains QA simulations only. The helper initially expected audit action `create`; it was corrected to the existing database action `insert`, with no app/data change.

The same request was retained for the separate missing catalog name in the list (PH5-SUPPLY-023), then cleaned after both fixes passed. Two creation/deletion audit rows remain; repeated deletion affects zero rows, stock remains six and the refreshed request counter returns to zero. Production deployment `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601` remains unchanged. Rollback QA deployment `9fb1f39e-ce99-4791-969a-d552e792825f` is preserved.
