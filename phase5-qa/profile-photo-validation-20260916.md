# Profile photo workflow — September 16

## PH5-SETTINGS-005 — QA blocks persisted signed images

The QA Super Admin saved one harmless 69-byte teal PNG. Storage readback matched
the file exactly and refresh retained one profile path, one object and its audit
event. The browser rendered a broken image after refresh: QA `img-src` allowed
local/data/blob images but omitted the isolated database's signed-storage path.

The targeted QA header change permits only the configured QA project's
`/storage/v1/object/sign/` image path. Script and connection restrictions remain
unchanged. Production headers/configuration are untouched. Five header tests and
all 1,624 retained frontend tests pass, zero skipped. QA build passes and all 511
source files match. The application entry remains byte-identical to the prior QA
release; only the response header changes. QA release
`3f7a8c68-5505-4101-8f88-130fa0bdd2d2`, source
`ab044540fc5fd51a22a7bbeb1f443d6840349835`, passes all 20 hosted checks.
After full refresh the actual browser shows the solid teal photo on the profile
page and account avatar. Prior QA release `e40c619e-a01d-4105-b6ef-6f9d6f394eb4`
is preserved. Production release remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`.

The private QA bucket was initially absent; it was provisioned with image-only
uploads and a 5 MiB limit matching the tested profile UI. Initial owner-only
checks passed but did not preserve all existing source permissions. The revised
QA policy preserves authenticated reads, self-service writes and existing Super
Admin management, with the established QA active/approved profile gate. Thirty-
three offline PostgreSQL checks pass. Automatic review initially blocked the
permission expansion; the user explicitly approved the exact QA policy before
it was applied. Saved SQL receipt: `a0ba1776-9df9-4e28-bbd0-66080abf2a1e`.
All 54 live checks pass: 12 QA identities plus anonymous access, signed and
authenticated byte integrity, public denial, owner upload/upsert/removal,
ordinary-user cross-owner mutation denial, inactive/unapproved denial, existing
Super Admin management, duplicate rejection and MIME restriction. All disposable
probes were removed. Previously issued signed links can remain cached; deletion
is verified with a fresh signed-link request and cache-busted authenticated read,
not a claim of immediate revocation of existing cached links.

UI removal cancellation retains one exact 69-byte object. Confirmed removal and
full refresh leave no photo or Remove control. API readback confirms one profile
equal to the original and zero stored photos. Five new profile audits (including
the theme checks) and the single photo-update notification are retained; only its
unread state was cleared. No external notifications,
password changes, camera access or production writes are part of these checks.
Private receipt: `qa-profile-settings-20260916.json` outside Git.
