# Custom supply draft save

PH5-SUPPLY-001 — PASS for optional-ID save, September 15, 2026.

The original Clinical Supply custom-item save failed twice with invalid UUID
syntax. The form represents absent department, subsection and catalog item IDs
as empty strings; the service forwarded them to nullable UUID columns. One empty
QA draft was retained after the first failed create; it was reused for all tests.

The service now converts only those three empty strings to null. Valid UUIDs,
explicit nulls and the caller's input remain unchanged. No schema/connection/
permission changes in this fix. Eight actual-service tests: original two pass,
six fail; repaired eight pass. All 1,389 retained frontend tests pass, zero skipped.
QA build, 510-file parity and 17 hosted artifact/isolation checks pass.

Source: `8470d63b35ce8f56db6aec89cf0e03e746d1bd48`.
QA deployment: `f4288986-8ab1-4d3b-8d4f-69e48bc9d28d`.
Entry `assets/index-DoGD4lDG.js`, 8,829,051 bytes, SHA-256
`b09b062601bde0d76f1a90655c9dcd53dd6f85b48aacc49a432c3c3525d13306`.
Rollback `9935d19e-4e4f-425f-aef1-3c08bfab60ed` retained.

Live: same batch ID, one labeled custom item, three optional IDs null. Edited
quantity 1 to 3 and note v1 to v2; visible "Draft saved" confirmation. A full
refresh and request detail show one item with quantity 3; database readback
confirms one batch/one item and the edit. No request submitted or external order.
Production remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`, unchanged.

The complete supply workflow is not yet PASS: draft create/edit has no audit
rows, and a repeated role matrix confirms broad request/item reads for inactive
and other-office accounts. These are separate remaining defects. The single
synthetic draft/item remains tracked for further verification and final cleanup.
