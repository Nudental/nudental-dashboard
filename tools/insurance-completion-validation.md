# Insurance completion validation

Completion now requires an answer for every applicable item in
`recovered-frontend/src/config/insuranceCompletionRules.json`. A blank answer is
different from an explicit unavailable answer. Staff may enter NA, N/A,
Unavailable, Not provided, or another text answer when information is unavailable.
This also works for numeric, date, Yes/No, and enumerated fields through the
form's **Information unavailable? Record NA or another answer** controls.

Unavailable typed values remain null, with their actual text retained in
`form_data.not_applicable`. They are shown on completed records and in an added
PDF section; no made-up date, amount, or percentage is substituted. A patient's
missing identity information may still require chart-match review in the existing
Ascend filing workflow.

The UI disables both completion buttons until required answers are present. The
service validates again, and a security-invoker BEFORE trigger rejects incomplete
INSERTs or transitions to completed, including requests from older browser tabs.
Draft saving, completed-content locking, historical completed records, and delivery
tracking retain their existing behavior. Conditional details depend on coverage
and Yes/No answers; 0% and No are valid answers.

## Verification (2026-11-19)

- 43 Node regression tests passed, including blank/whitespace rejection,
  unavailable answers for all 134 rules, real zeros/false, conditional details,
  invalid numeric/date ranges, service enforcement, and both completion controls.
- Migration self-tests checked every rule missing and five unavailable-answer
  variants against the actual Postgres validator before the migration committed.
- Transaction-isolated production tests used Patricia's existing authenticated
  role. Incomplete updates and direct completed inserts failed; drafts remained
  writable; complete and unavailable-answer examples completed and queued the
  office notice and chart filing. Locked contents and legacy tracking updates
  remained protected/usable. All synthetic records and queues were rolled back.
- Existing counts remained 3 requests, 2 breakdowns, 1 historical notice, and
  zero chart-filing jobs. No emails or chart uploads were sent by tests.
- Browser test of the actual form with synthetic service boundaries confirmed
  blank/whitespace blocks completion, NA/text enables it, draft saving works,
  and confirmation submits the unavailable answer.
- PDF renderer generated and visually checked an unavailable-answer appendix.
- Production build passed; security-advisor findings did not increase.

Regenerate the SQL body with
`node tools/build_insurance_completion_migration.cjs <new CLI-generated migration path>`
when changing the registry. Do not edit an already-applied migration for a future
release. Test with `node --test tools/test_insurance_completion.cjs`.
