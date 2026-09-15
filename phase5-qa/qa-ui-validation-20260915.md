# Phase 5 QA browser validation — September 15

The browser preview uses the actual isolated Supabase project
`hvtxjfayenqnwtaisoaw`, synthetic `qa_office_manager`, and the QA-only connection
policy. Persistent Pages/API deployment remains pending. No production source,
configuration, routing or business record changed during these checks.

| Issue | Reproduction and cause | Targeted repair | Verification |
| --- | --- | --- | --- |
| PH5-UI-001 — EOD permission-loading crash | Office-manager login navigated to EOD and crashed with React error 310; refresh reproduced it. The loading/denied return preceded a callback and four effects, changing hook order when permissions resolved. | `daily-entry-form/index.jsx`: retain the same permission check in a wrapper and mount the existing form only when allowed. | Focused negative control failed with five additional hooks; repaired tests 2/2 PASS. Rebuilt QA preview loads EOD after refresh. Loading/denied renders cannot start draft/office effects. |
| PH5-UI-002 — EOD draft loses checked attestation | Save typed synthetic notes and “Noted exceptions below”; refresh retained notes but cleared the checkbox. The serialized draft contained only form fields; checklist-only changes were also skipped. | Same component: include attestation in serialization and callback dependencies, restore it separately, and retain compatibility with older notes-only drafts. | Negative control 2 failures/1 pass; repaired tests 3/3 PASS. QA browser displayed Saved, then both notes and checkbox survived refresh. |
| PH5-UI-003 — Assigned office missing from EOD form | The header showed QA Office A, but the disabled form selector was empty; two submission attempts reported “Practice location is required.” AuthContext omitted office_id from its profile projection, and the form could not infer it from the multiple-office directory. | Add office_id to the existing profile read projection; retain all access-gate fields and permission rules. | Negative control failed for both synthetic offices. Three focused checks pass. Rebuilt QA browser selects Office A and successfully submits exactly one pending attestation, confirmed through ordinary-user Auth/PostgREST readback. |

All 1,053 retained frontend tests passed, with zero skipped tests, using the
preserved Phase 4 artifact for parity comparisons. The final QA production-mode
build passed and contains no server secret or either captured production client
credential. Its QA banner and connection policy remain present.

Artifact: `index-BCD7JFKP.js`, 8,821,497 bytes, SHA256
`6fda356d71d6e0b9cee10852e258e7c5905ccd746bed42c9f0ffac8764be21c9`.
This is a local QA preview, not a production release or completed hosted API test.

One synthetic local EOD draft remains for continued workflow checks:
`QA TEMP PH5-EOD-20260915 draft B`. It has not been submitted to the database.
Draft storage is currently browser-local; API audit history and committed workflow
persistence have not yet been verified. Cleanup is pending the remaining tests.

The first automated textarea fill did not update React's displayed character
count; that run was discarded. Actual typed input updated the count and was used
for the documented persistence reproduction and retest.

After PH5-UI-003, all 1,056 retained frontend tests passed with zero skips.
Latest QA entry: `index-D24EYxWd.js`, 8,821,508 bytes, SHA256
`69b22d82bfa1ec663a88432c4e837a5846eab511cddb79219d5d1f5673ca08d4`.
The QA banner, connection restrictions, and private credential checks passed.

The previously noted draft has now been submitted as synthetic entry
`1bd849be-d0f2-4a0f-8c55-68e431b2b2af`. UI success and pending status match the
database, and notes include the selected attestation. No duplicate was created.
Neither `audit_logs` nor `eod_status_history` contains the initial submission;
this is under investigation. Approval/counter checks and cleanup remain pending.
