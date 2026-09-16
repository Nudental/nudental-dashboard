# Receipt controls follow existing supply writer roles

PH5-AUTH-021 — PASS in isolated QA on September 16, 2026.

An ordinary Office Manager could open Receive on a readable pending fulfillment row and submit it. The database correctly denied the update; the form showed a single-row coercion error. Exact before/after readbacks show the labeled zero-cost receipt remained Pending with zero received units and its one creation audit. No stock/request/provider links exist.

The existing database function `is_supply_admin_or_above` allows super_admin, admin and regional_clinical_manager. `FulfillmentLogTab` already receives matching `isAdmin`/`isRCM` flags for other write controls, but Receive and its open modal lacked that condition. Two UI conditions now use the same flags. No database permission, authentication, credential or account change was made.

Ten rendered-component tests changed from 4 pass / 6 fail to 10 pass, covering all eight actual roles, pending/partial/backordered versus completed/cancelled rows, an already-selected modal and the unchanged desktop layout. All 1,492 retained frontend tests pass with zero skips. Build, 510-file parity and 17 hosted isolation/deployment checks pass.

Source `f9681ac069a923df3ec8939f9415bf01b99908f1` is pushed. QA release `5f66c390-e1ba-457a-bc88-cc76f8b356ad` uses `assets/index-BcKKa8I4.js`, 8,830,019 bytes, SHA256 `bc9960099a81ac254cb8be751880be79e124813f9cb0da777adaf2221dc32cfc`. Previous QA `08136072` is recoverable; production `1f1f91bc` and main are unchanged.

Live original Office Manager check: the pending synthetic row remains readable and Receive is absent. Existing QA administrator check: Receive is available; a one-unit partial receipt reports success, persists Partial with qty_received=1 and the administrator UUID, and adds exactly one correct update audit. Full refresh retains Partial and its receipt date. Receipt: `qa-receipt-actor-20260916.json`.

The synthetic receipt remains for the separate receiver-name display defect: its editable name accepts alternate text, while the service correctly records the authenticated actor. Linked stock, partial-receipt accumulation and multi-item atomicity are not claimed verified by this UI permission repair. No camera or provider was used.
