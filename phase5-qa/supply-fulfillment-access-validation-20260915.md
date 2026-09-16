# Fulfillment API access

PH5-AUTH-017 — PASS in isolated QA, September 15, 2026.

Two live read matrices confirmed that every one of the twelve QA identities
could read the labeled Office A fulfillment, including Office B, inactive and
unapproved accounts. The copied `fulfillment_logs_read` policy used `true`.

Migration 028 adds a restrictive ALL policy requiring an active profile, an
accessible office resolved from the existing office name, and the existing
Clinical Supply view permission (or Super Admin). That page and its reports are
the frontend consumers. Existing write-role checks are retained; role grants,
authentication, production policies and record values are unchanged.

48 actual PostgreSQL checks and all 58 installation checks for 28 migrations pass.
Source `6f04826ffcde7790abe616c8c7a349dbac95dcf9` is pushed. Applied only to
`hvtxjfayenqnwtaisoaw`; saved SQL receipt
`c57b6840-3b2e-45cb-b04c-026f4c6d7869` confirms RESTRICTIVE ALL.

Live: the existing grants allow Super Admin and Office A manager to read one
record; the other ten identities see zero. Eleven non-writer PATCH attempts
change zero rows, with exact before/after equality. Super Admin's full page
reload still displays one record. Tests also cover privileged writes when the
existing section permission is enabled and continued inactive-account denial.

The frontend remains QA `79d267a7-10ad-44bb-bfaf-0d12b9316018`; production remains
`1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`. The one temporary fulfillment and approved
supply request remain for subsequent audit testing and cleanup. No camera used.
