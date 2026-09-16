# PH5-BONE-002 — optional fields prevented manual inventory saves

Live QA reproduction twice: a labeled manual Bone/Tissue entry with provider,
staff assistant, and expiration omitted failed with `invalid input syntax for
type date: ""`. Both attempts left zero records and zero audits. The schema
declares the date and both UUIDs nullable; both entry components supplied empty
strings instead of SQL null.

The shared service now converts only empty strings in those three fields to
null for create/update. Valid values and omitted partial-update fields remain
unchanged. Required fields, permissions, stock logic and database structure are
unchanged. Nine actual-service cases originally passed 3/9; the repaired suite
passes 1,370/1,370 with zero skips. QA build and 510-file source parity pass.

Source `29bf7fbb6d88c8ccae954d760126a4d245385a08`, QA release
`672ebed4-2af8-4b4b-8163-8023a8209ec7`, entry `assets/index-CyJjwNir.js`, SHA256
`754c217e949b101636942aae68bb18d03498bc755eaad1aec9d30763117c5fa4`.
Seventeen hosted checks pass. Prior QA `bd5eea64-fa76-4ad8-8b90-12becf47b207`
retained; production `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601` unchanged.

Live PASS: the original mobile save succeeded with one inventory record and one
creation audit; all three optional fields are null. Counter In Stock=1. Refresh
and desktop edit read back the fixture. Editing the note with optional fields
still blank succeeds on the same ID, with exactly two audits. A second refresh
shows note v2 and visible created/updated history. The camera-free default is
retained; no camera permission was granted.

Temporary fixture `b3f118a6-4605-4b9f-914e-2ed4a0666384`, label
`QA TEMP PH5-BONE-20260915`, remains only for subsequent permission, date-display,
stock and cleanup checks. Receipt: `qa-bone-ui-20260915.json`. Do not claim the
entire Bone/Tissue workflow complete yet.
