# Current Inventory QA office columns

PH5-QA-SUPPLY-008 — original display test PASS, September 16, 2026.

Twice, Current Inventory displayed the persisted five-unit QA catalog fixture
with four production office columns and N/A in every quantity cell. Its office
filter also lacked the two QA offices. FrontDeskCurrentInventory hardcoded
production names separately in filters, grouped columns and grouped CSV.

The component now takes the existing environment-specific office list from
frontDeskInventoryService. Grouped CSV uses that same ordered list. Production
labels, column ordering and CSV output are preserved; no data or configuration
was changed. Six actual initializer/export tests went from 3 pass / 3 fail to
6 pass. They cover QA values, missing versus zero quantities, unchanged
production output, and single-office output. All 1,431 retained frontend tests
pass with no skips; the QA build, 510-source-file parity and 17 hosted checks pass.

Source 21b65d7702ed0c375fa94f47bb4ad89597a16518 is pushed. QA deployment
0c221564-8d39-4893-a822-932699e91405 uses assets/index-DtA0hpt5.js,
8,829,649 bytes, SHA256
24696ca6e255fd84fff3e8c83ceaaabffaac97cb52cfa3185e068dec5dc8b334.
Previous QA acf10c88 is preserved. Production deployment 1f1f91bc is unchanged.

After full refresh, the live grouped row shows five units and Low under QA
Office A, N/A under QA Office B. The Office A filter displays one record with
the same quantity/status; counts remain one item / one office record. A grouped
CSV click produces no console error, but the browser download event does not
arrive and no matching file appears in Downloads. Browser file-save completion
is not claimed. Export content is verified by the actual-handler tests only.

The synthetic catalog item remains for audit/access/lifecycle testing. Migration
032 is a separately tested access restriction and remains UNAPPLIED pending
explicit user approval after automatic approval review rejected its execution.
