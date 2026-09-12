# NDASH-069 — Adjustment filters can display the previous selection's results

Section: RCM Adjustment. Severity: Medium. Status: tested; deployment and live verification pending.

Reproduced twice before editing and again after the Work computer restarted: select Professional Courtesy from settled All Categories in August 2026. The selected value changes, but after loading ends the summary remains 1,235 records / -$341,447.87. Explicit Refresh returns the correct 2 records / -$90.00. No patient identifiers or notes were recorded.

Root cause: four filter handlers call load(1) immediately after scheduling state updates. That callback still closes over the previous filter values. The existing effect also requests the new filter values, allowing the stale request to overwrite them.

Smallest fix: remove only the inline load(1) from Include Voided, adjustment category, review flag and page size handlers in recovered-frontend/src/pages/rcm/components/AdjustmentTab.jsx. Retain the existing load callback, dependencies, effect, paging, calculations and backend. Rocket version 798 matches these four removals.

Verification: four actual-source handler tests failed before the change. Their asynchronous harness now awaits the actual callback promises rather than two arbitrary microtask turns. All 305 source tests pass; production build passes in 37.85 seconds. The actual compiled component's four handlers reproduce two requests before and one request using the chosen state after. Full reversal to release 068, prior repair preservation and seven dependency relinks pass. No typecheck script exists.

Candidate: index-6fc5cf035c7e.js, based on live release a8a2fe4d-db23-4df0-a7f2-8233b238753f. The complete recovered build is not released. Blocked changes 042 and 066 remain excluded. Existing backend 067 is unchanged. No business records, financial actions, exports or provider sync were triggered.
