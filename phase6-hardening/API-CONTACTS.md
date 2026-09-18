# RCM contact identity and office boundary

The four existing manual-contact routes are a tested candidate; deployment is
pending its fresh backup and live gates. No new contact workflow or delivery
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
