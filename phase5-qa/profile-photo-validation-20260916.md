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
release; only the response header changes. Publication/live replay pending.

The private QA bucket was initially absent; it was provisioned with image-only
uploads and a 5 MiB limit matching the tested profile UI. Initial owner-only
checks passed but did not preserve all existing source permissions. The revised
QA policy preserves authenticated reads, self-service writes and existing Super
Admin management, with the established QA active/approved profile gate. Thirty-
three offline PostgreSQL checks pass; live policy parity verification pending.

The temporary UI photo must be removed and the exact original profile restored.
Audit and in-app notification history will be retained. No external notifications,
password changes, camera access or production writes are part of these checks.
Private receipt: `qa-profile-settings-20260916.json` outside Git.
