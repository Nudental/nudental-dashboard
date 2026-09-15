# PH5-INSURANCE-001 — required appointment time

Status: QA repair deployed and live validation PASS. Production unchanged.

The native New Request form treated appointment time as optional. Two settled UI
save attempts with the visible required fields populated created no request or
audit row. The exported production schema defines `appointment_time time NOT NULL`,
and `createVerificationRequest` sends null when the field is empty. An isolated
PostgreSQL reproduction confirms SQLSTATE 23502 for that exact column, zero rows
after rejection, and successful insertion with 09:00. A hosted synthetic request
saved successfully when 09:00 was supplied; the UI reported Request Submitted and
No email has been sent.

Smallest fix: `NewVerificationRequestForm.jsx` marks appointment time required,
validates it before persistence, and displays the field error. It does not invent
a default, change schema, or affect credentials, external delivery, or production
configuration. Source `863d7789a8579f30d2fad6175d96da1f85ac266d`.

Verification:

- Actual source validator/submit-handler regression: before 1 PASS / 3 FAIL;
  after all four PASS. Missing time cannot call persistence or report success.
- Three isolated database-contract checks PASS.
- 1,342 retained frontend tests PASS, zero skips; QA build and all 510 source-file
  parity checks PASS. QA-only destinations/no production credentials PASS.
- QA release `3585cd6c-c7fe-47e6-a683-a03b8e138e5a`; 17 hosted checks PASS.
  Entry `assets/index-BgDKvQjH.js`, SHA256
  `eb27d016c8299f2d55383076aa1d4a5a1ed2dbf4fa4428bd0ec8f02752352a0a`.
  Previous QA `d7acf707-f2e4-4078-aac9-7ba30762fb1e` retained.
- Live repaired form shows Appointment Time* and Required on blank submit.
  Reset clears validation. Existing request survives refresh and remains one row,
  with one `request_created` audit and no delivery/upload timestamps.
- Production deployment remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.

Safety/evidence notes: the browser's text representations concealed populated
phone/email inputs; screenshots and saved-row readback confirmed their values.
Automatic approval review blocked additional missing-time submits; those blocked
attempts were not executed or counted as tests. No camera access was granted.

Synthetic fixture `8582be7b-3f03-4e65-b9c7-1825f6fae517`, label
`QA TEMP PH5-INSURANCE-20260915`, remains for the following draft/completion and
permission tests. **Cleanup still required.** Receipt outside Git:
`qa-insurance-ui-20260915.json`. Remaining insurance workflow checks are not yet
claimed as complete; no insurer submission, email, or Dentrix action was performed.
