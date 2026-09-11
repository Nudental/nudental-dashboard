# NDASH-020 — Regional Manager Items column was a fixed placeholder

- Reproduced live before/after refresh: both historical requests show a dash under Items; detail expansion and an independent read query confirm each contains two items.
- Root cause: the table cell is a literal dash. The existing batch read now supplies related items through NDASH-019.
- Fix: one expression in `PendingRequestsTable.jsx` displays the related item array length, preserves genuine zero, and leaves unavailable relationships as a dash. No extra request or change to business data, approvals, notifications, or configuration.
- Actual deployed cell: populated, empty, and missing relationship scenarios PASS; syntax and exact reversal PASS. Cumulative frontend tests PASS (64). Source build result and live verification to be recorded before closure.
- Candidate asset `index-e87e43327b87.js`, SHA256 `e87e43327b87031be39e8539c2021a48d36d9d45b94b1cf4e40d84445a46ca53`. Previous `ndash019-dist` preserved.
