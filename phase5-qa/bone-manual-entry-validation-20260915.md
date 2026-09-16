# PH5-BONE-001 — manual entry must not start a camera

The live mobile Bone & Tissue Add Entry wizard mounted a running scanner on
step 3, before a scanner was selected. Its manual-entry button did not advance
while the permission request was pending. No camera permission was granted;
reloading discarded the unsaved synthetic form and stopped the request.

Root cause: `MobileEntryModal.jsx` initialized `scanMode` to `true`. The one-line
repair initializes it to `false`; the existing explicit Switch to Scanner action
is retained. This changes the Bone & Tissue entry wizard only, not scan-specific
Receive/Consume actions or the Implant wizard. Physical scanning is untested.

Three tests execute the actual JSX component: create/edit defaults have an ID
input without mounting the scanner; explicit scanner selection/manual return
remain supported. Original: 0/3 pass. Repaired: 3/3 pass. Retained suite:
1,361/1,361 pass, zero skips; all 510 source files match the QA build tree.

QA release `bd5eea64-fa76-4ad8-8b90-12becf47b207`, source
`a96b8035624940107afa7489cf4a2ea715872610`, entry `assets/index-D_uaifIk.js`,
SHA256 `0e08c0f4827c4f006ff2ddc40a99866fa0e3c3754011573b8503384e3b6cbbe7`.
Environment/build guards and 17 hosted checks pass. Previous QA release
`70a2dd16-9e95-4d47-8e4a-3a6b7aee7ee4` remains recoverable. Production remains
`1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`; canonical main is unchanged.

Live PASS: repeat Add Entry → QA Office A → synthetic patient → product-ID step
now displays Enter ID number and Switch to Scanner, with no camera startup.
Entering the harmless QA ID and advancing to Product Details works. No record
was persisted by this camera-default check. The separate inventory write audit
continues with the same explicitly temporary label.
