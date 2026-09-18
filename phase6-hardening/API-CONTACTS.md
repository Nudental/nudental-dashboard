# RCM contact identity and office boundary

The four existing manual-contact routes are DEPLOYED and verified from `209d518538390c1384e2c9505993be80d38f3bc1`. No new contact workflow or delivery
integration is introduced.

The preserved create handler accepted caller-supplied actor ID/name and office
without downstream identity checks. The exact handler reproduced the issue
against intercepted in-memory storage. No production record was written.

The candidate uses the current active/approved user and the existing
`finance.rcm.statements.view` tab grant (or Super Admin). The Statements tab is
the only frontend caller of these routes. Creation attribution uses the current
profile name and verified user ID; a body cannot claim another actor. Office
names come from the existing canonical map.

Office-scoped users must specify the actual `location_id` filter. An ignored
alias, unknown office, duplicate selector or another office is denied. Global
users retain all-office reads. Updates load the existing record's office and
bind the PATCH filter to that same office, so a body cannot relocate it and a
concurrent relocation cannot evade the check. Existing records with a null
location remain editable only by all-office users; no legacy record is changed
by this release. New records require an explicit known permitted office.

Supabase query values are URL-encoded so patient/date fields cannot introduce a
second scope filter. The patch allowlist and existing outcome validation remain
intact. No new patient-balance calculation or accounting treatment is added.

149 native tests and all 17 retained backend suites PASS, with zero blocked
guard attempts and all unrelated route bodies unchanged. Tests exercise the
actual handlers with synthetic storage, including cross-office refusal,
attribution spoofing, scope injection, concurrent office changes and nullable
legacy records. Positive production writes remain intentionally untested.

## RCM contact-record identity and office boundary — deployed

Source `209d518538390c1384e2c9505993be80d38f3bc1` applied at 2026-09-18T07:43:24.066901+00:00; main SHA256 `734a190e8f5558fe103e25186e9f960da33c77c7713e6034ae3a14440c709372`. Four manual-contact routes now verify the current account, Statements permission and actual office scope. Created actor/name and office name cannot be forged. Updates bind to the existing record's checked office; request filters are encoded. Nullable legacy office records remain editable only by all-office users. No delivery functionality changed.

149 native tests and 17 retained suites PASS; isolated QA Super Admin/Office Manager/Regional Manager identity resolution and invalid-session checks PASS. Inactive/unapproved QA sessions were expired, so live negatives were not rerun; native negatives remain covered. All 20,870 fresh guarded original rows and configuration/jobs are preserved; the production contact-attempt table remained empty. Candidate and production missing/invalid 401 and job 403 probes PASS, existing payroll validator 200. Live Patient AR Follow-Up rendered 30 rows with no contact-summary warning/error. Positive creates/edits used synthetic native storage only; zero real contact records or provider actions were performed. Production/QA health PASS.

Recovery: `backup/api-before-phase6-contacts-20260918`, `api-contact-backup-20260918T074308Z`. Private backups are preserved locally and on the server. Final main integration remains pending the remaining route review and regression.
