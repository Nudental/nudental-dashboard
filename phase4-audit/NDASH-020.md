# NDASH-020 — Regional Manager Items column was a fixed placeholder

- Reproduced live before/after refresh: both historical requests show a dash under Items; detail expansion and an independent read query confirm each contains two items.
- Root cause: the table cell is a literal dash. The existing batch read now supplies related items through NDASH-019.
- Fix: one expression in `PendingRequestsTable.jsx` displays the related item array length, preserves genuine zero, and leaves unavailable relationships as a dash. No extra request or change to business data, approvals, notifications, or configuration.
- Actual deployed cell: populated, empty, and missing relationship scenarios PASS; syntax and exact reversal PASS. Cumulative frontend tests PASS (64); production source build PASS (36.84s).
- Candidate asset `index-e87e43327b87.js`, SHA256 `e87e43327b87031be39e8539c2021a48d36d9d45b94b1cf4e40d84445a46ca53`. Previous `ndash019-dist` preserved.
- Deployment `8c043e7b-0abf-4c42-a704-0fbf4d556f53` PASS. Live PASS: both historical parent rows display 2, first request expansion has two actual item rows, and searching a contained item retains one parent row with count 2. Sorting still works in both directions. No request state or business record changed.
