# NDASH-084 — Selecting Staten Island hides the office picker without recovery

Section: RCM / eAssist Reports. Status: candidate verified; release pending.

Reproduced twice, including after full reload on frontend082/backend083: selecting Staten Island displays the intended unsupported-office notice, but hides every local filter including the office picker. There is no local reset/recovery button and no report table. Reload or leaving/reopening the section is required to recover.

Root cause: the neutral message is rendered when showStatenIslandMsg is true, while the complete filter panel is inside !showStatenIslandMsg. Smallest fix: add one type=button labeled Show all eAssist offices inside the existing notice, calling only setOfficeFilter('all'). Preserve all other filters/state, notice text, fetch behavior and prior repairs.

Verification before release: existing355 frontend tests PASS; production build29.93s PASS; Rocket810 completed exact button. Actual compiled neutral-message insertion reverses exactly; its callback calls the existing office setter once with all. Entire entry reverses to082; prior repairs and seven dependency relinks PASS. No stylesheet/backend/configuration or record changes. Backend083 unchanged;082 recovery graph retained. Live recovery cycles and other-filter preservation remain release gates.

Separate page-size observation: after083, both page2/50→10 and page7/10→50 reset correctly to page1. The earlier stale page display was not reproduced in those follow-ups. Leave request-order handling as an intermittent source concern, not part of084.
