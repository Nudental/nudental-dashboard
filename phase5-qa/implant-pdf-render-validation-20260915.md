# PH5-IMPLANT-006 — PDF attachment readback

Reproduced on live QA after the attachment storage repair: the refreshed inventory edit form rendered a saved PDF with an image element, resulting in a broken preview (natural size 0 × 0). The file existed and downloaded intact; this was a rendering defect.

`AddImplantModal.jsx` now detects selected/stored PDFs and presents an Open PDF attachment link with `noopener noreferrer`; image attachments retain their image preview. No save, storage, role, or business calculation behavior changed.

- Focused actual JSX tests: before 3 PASS / 4 FAIL; after 7 PASS.
- Retained frontend suite: 1,306 PASS, zero skips.
- QA build: PASS; all 510 source files match the build input; QA connection/credential guards PASS.
- Source `cb23dcefd3e1e87850a059a5645d96510d681fa0` on the existing Phase 5 branch.
- QA deployment `9ae94c45-07d7-4c2f-8b34-fa237ef5cb68`; previous `a801c897-7869-4033-ac46-f33b7b4fdb1a` retained.
- Entry `index-D-tVY1jn.js`, 8,828,755 bytes, SHA-256 `e5420dcaae34569119fc9fa543d3e7ae4f575a7973d4914a3bd5de363dd500e8`.
- Hosted checks: 17 PASS, including unchanged production deployment/entry and API environment boundaries.
- Live UI: refreshed the original synthetic inventory, opened edit/tracking, clicked Open PDF attachment; browser PDF viewer showed one page and both original QA-only lines. PASS. Closed the viewer and canceled edit without another write.

The separate Storage test verified exact download bytes and hash. Native browser Save As remains unverified; opening and rendering the actual saved PDF is verified. No camera permission was accepted. Production deployment `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601` and canonical main remain unchanged.
