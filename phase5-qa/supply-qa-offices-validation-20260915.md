# QA supply office selectors

PH5-QA-SUPPLY-001 — PASS, September 15, 2026.

Both Front Desk and Clinical Supply used a fixed array of four production office
names. Reproduced in their empty new-request forms; neither offered the two
synthetic QA offices. No request was submitted during reproduction.

The two services now select the existing synthetic names when the validated
environment is QA. Production/default options remain byte-for-byte unchanged.
No connection, credential, routing or schema changes.

The six tests execute each service's actual office initializer/getter in QA,
production and default modes. Original: four pass/two fail. Repaired: six pass.
All 1,381 retained frontend tests pass, zero skipped. QA production build and
510-file source parity pass. Seventeen hosted isolation/artifact checks pass.

Source: `d52108d5311881b1a8945a28e039e1b73e66e158`.
QA deployment: `9935d19e-4e4f-425f-aef1-3c08bfab60ed`.
Entry: `assets/index-D50d79xh.js` (8,828,805 bytes).
SHA-256: `1ea92908634682c2410e41dbbce495d98e08cd282fdb98700d990ca7da4df488`.
Previous QA deployment retained: `9a99231f-5b40-49f3-b6c1-265be834820e`.

Live refresh shows QA / Office A and QA / Office B in Front Desk and Clinical
Supply selectors. Both screens load normally. No temporary records created.
The publisher initially returned the previous canonical deployment during
Cloudflare propagation; a subsequent read confirmed the new ID and source above.
Production remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`, unchanged.
