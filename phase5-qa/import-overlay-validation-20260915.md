# PH5-IMPORT-002 — import dialog below navigation

Reproduced with the desktop sidebar expanded: the Parse Data button's center was covered by `NAV`, so a normal click did not parse the synthetic row. Collapsing navigation made the same control work. The modal used z-index 50 while the existing sidebar uses 80 and header 100.

Changed only the outer `ImplantBulkImportWizard` overlay class to `z-[210]`, placing this dialog above the existing navigation. No parsing, import, permission, or record mutation logic changed.

- All 1,311 retained frontend tests PASS, zero skips. QA build, 510-source parity, and environment guards PASS.
- Source `8dfcdb4921ec697a0f1b07fa6fbd98f17061b0e9`, pushed.
- QA deployment `ca0a75da-7000-466f-b933-fb8390ed0bd7`; previous `0230972b-3c0e-4f81-9647-bc7ee0f9159e` retained.
- Entry `index-Cqyx_myE.js`, 8,828,987 bytes, SHA-256 `595fdb6b4014fc27da2de67ac53da541233503fcfb37548023fe412f895a8e02`.
- Hosted checks: 17 PASS, including unchanged production.
- Live repeat with sidebar expanded: button center resolves to Parse Data itself; normal click reports one parsed row; preview and confirmation controls work. PASS.

The separate one-row synthetic import execution follows this repair; its outcome is not assumed from the overlay check.
