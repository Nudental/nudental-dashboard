# NDASH-117 — Category creation reports a save that never occurs

Inventory / Implant & Grafting / Bone-Tissue / Settings. Medium.

Reproduced twice on live116: the clearly labeled TEMP QA NDASH-117 category appears once and reports added successfully, then disappears upon Settings re-entry / full refresh. Actual deployed handler was inspected first: local React setters only, zero await or persistence calls. No production record was written. Refresh removed the temporary state; four original categories remain.

Root cause: handleAddBtCategory only modifies btCategories in memory. loadBtCategories reloads built-in types plus distinct existing inventory types. The UI falsely promises shared changes and saved success. Recovered entry form uses a fixed Bone/Tissue/Membrane/PRF/Other list; the retained schema defines the same enum. No supported category-master write path exists in this implementation. No schema migration was run.

Minimal mitigation: handler reports creation unavailable without changing rows or reporting success; input and Add Category disabled; explanatory paragraph and read-only description replace the false shared-save promise. Existing category reads, hooks, stock operations, reports and all other code preserved. Full custom-category functionality remains unavailable and requires a separately designed persistence/entry-form change.

Three new regressions fail before / pass after. All528 frontend regressions PASS. Production build33.52s PASS (sandbox build service initially stopped; existing build succeeded with authorized execution). Rocket843 confirmed scoped one-file change. Actual deployed-component patch has five edits; full reverse116 and seven dependency relinks PASS. Candidate index-d54a1dcf586b.js; deployment/live verification pending.
