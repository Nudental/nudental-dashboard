# Urgent request on-hand quantity by office

PH5-SUPPLY-022 — reproduced live, candidate tested; live deployment verification pending.

With QA / Office A selected, choosing the existing QA TEMP Clinical Item 20260916 fills On Hand: 0, although the inventory UI and bounded database read both show six units. Switching to Office B and back to Office A repeats the zero. The form was canceled without saving either time.

Root cause: master search only loads `supply_items` catalog records, which have no office quantity. Its missing quantity becomes zero; changing office never reads `office_supply_inventory`.

The small repair adds an optional exact-item filter to the existing inventory service and reads stock when a catalog item and office are selected in the form. Empty authorized office inventory means zero; duplicate, malformed or failed reads leave quantity unknown and request manual entry. A pending lookup disables submission and quantity editing. Canceled/stale responses cannot overwrite newer selections. Custom-item manual entry, request metadata and existing inventory caching remain unchanged. No data/schema/policy/configuration changes.

Nineteen focused frontend tests pass: actual stock, empty office, stale response, failed/malformed/duplicate reads, custom/manual entry, missing office, inactive form, pending/invalid quantity submission, explicit zero, exact query filters and preserved cache behavior. All 1,580 retained frontend tests pass without skips. QA build, source parity and environment checks are recorded separately. Original Office A six / Office B zero / return-to-A six, refresh and cancellation checks remain to be verified on the deployed QA page.
