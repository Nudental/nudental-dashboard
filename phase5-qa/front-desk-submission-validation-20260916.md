# Ordinary Office Manager Front Desk submission

Verified in isolated QA, September 16, 2026. No production or provider write.

The existing synthetic Office Manager signs in through the normal UI and
creates a labeled Office A September 2026 request. Cart quantity edit from two
to three persists. Submit reports success; exact readback finds one submitted
batch, one line, and two audit events (draft_created and status_submitted).
Refresh shows the same month, creator, quantity and status with no duplicate.

The twelve-identity read matrix exposes the request, line and audit only to
Super Admin and the Office A Manager under the existing permission fixtures.
Fourteen live RPC checks pass: duplicate submission for both permitted users is
a no-op; ten other identities are denied; stale draft save and anonymous submit
are rejected. Complete row/audit snapshots remain unchanged after those tests.

The private execution receipt contains exactly one mocked email intent and one
mocked SMS intent, even after duplicate submission attempts. Saved read-only
SQL receipt 76e14e2f-d155-46ef-922d-9ab14fef567a is preserved. No external message
was sent. The QA frontend remains acf10c88 at this checkpoint.

The UI currently offers the Office Manager review actions on their own request,
although its help text describes Regional Manager review. A business-rule
clarification was resolved by the user on September 16: Regional Manager/Admin only,
with no self-approval. That rule still needs implementation and verification; no
approval or rejection was performed on this request.
The labeled fixture QA TEMP PH5-FRONTDESK-20260916 remains for that check and
must be cleaned afterward. Its exact identifiers and snapshots are preserved
privately in qa-frontdesk-ui-20260916.json; audit history must be retained.

Separate catalog tests are in progress and are not covered by this submission
PASS. Camera access is neither granted nor needed.
