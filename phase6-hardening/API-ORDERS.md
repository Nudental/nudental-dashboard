# Legacy Amazon request API boundary

Candidate verified; deployment pending the bounded release receipt.

This batch covers five existing route declarations: request list/create,
approve/reject and read-only Amazon order history. It does not grant or execute
provider authorization, carts, purchases, order sync or external communication.
The deployed Front Desk history UI uses Supabase directly, not these legacy API
handlers; the current table's existing UI policies remain unchanged.

The preserved approval handler reproduced acceptance of a forged reviewer against
synthetic storage. It had no current actor, office, pending-state or self-review
check. Production schema inspection also confirmed its `approved_by` and
`rejected_by` target columns do not exist. The request table currently has zero
rows; order history has 129. Request RLS is enabled with no ordinary policies,
so direct authenticated/anonymous access is default-denied. No database change
or public access grant is included in this API release.

Use the current active/approved human and existing permissions. Request creation
requires Front Desk page plus request permission; review requires Regional
Manager/Admin/Super Admin and the existing Approvals grant (Super Admin override).
An approval-only account cannot create a request or read purchase history. Office
checks bind reads to their real selector, creation to the verified actor/canonical
office, and review to the stored office/requester. Self-review is denied even to
Super Admin. Compare-and-set matches pending state, office and requester, so a
race or replay cannot silently review a different request. Filter values are encoded.

Approved attribution uses the existing `approved_by_user_id` and
`approved_by_email` columns. Rejection keeps its existing status/time/reason
columns; its verified actor, office and object are recorded in the existing API
service journal. No reviewer is mislabelled as the requester and no fictional
`rejected_by` column is added. This legacy table has no existing audit trigger;
this batch does not claim a new database/UI audit trail or execute a real review.

177 native tests and all 17 retained suites PASS with guarded network/business
data access and zero blocked attempts. Tests exercise the actual handlers and
existing payload helper against synthetic storage, including forged attribution,
page/request/review permission separation, offices, self-review, pending-state
changes, retries/races, encoded filters, failures and real schema field names.
All 23 unrelated materialized files and all unrelated route bodies are unchanged.

Production verification is limited to safe denial probes, read-only health and
the existing Front Desk history UI. Real requests, approvals, purchases and syncs
remain intentionally untested and are not authorized by this release procedure.
