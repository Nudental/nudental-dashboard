# PH5-AUTH-011 — Implant records and linked stock escape office scope

Eleven hosted QA API checks used two labeled inventory records, two unlinked
synthetic usage records, and one temporary linked usage attempt. Nine expectations
failed: staff and office managers could read the other office's inventory/usage;
inactive and unapproved accounts could also read both offices; and a staff member
could submit an own-office usage entry linked to the other office's inventory.
That last entry reduced the other office's temporary stock from five to four.
Admin all-office reads remained available. All temporary records were cleaned up.
Evidence is preserved outside Git in `qa-implant-office-boundary-original-20260915.json`.

Root cause has two parts. The recovered SELECT policies use `USING (true)` and
the usage INSERT policy checks only for a signed-in user. The existing
`implant_auto_deduct_stock` trigger then updates linked stock as its owner, without
checking the caller's access to that inventory office.

Candidate `012-implant-office-boundary.sql` adds restrictive active-account and
office policies for both tables. A small BEFORE INSERT/UPDATE guard separately
checks access to linked inventory before the existing deduction can run. It uses
the existing office-assignment rules, so authorized multi-office users keep their
access. Existing admin-only inventory writes, optional unlinked usage and the
stock deduction calculation remain unchanged. No records are migrated or changed.

The in-memory PostgreSQL negative control reproduces 13 failures. All 21 repaired
checks pass, including stock readback, own-office use, admin cross-office use,
inactive/unapproved denial, unlinked usage and retained admin/staff edit roles.
Every temporary write rolls back; both inventory quantities finish at five.

Deployed only to the isolated QA project after browser access returned. Saved
SQL snippet `f83480ec-0da8-4d9c-aecf-16085d12e25a` confirms both new policies are
restrictive. **14/14 hosted cases PASS**, including own-office stock persistence,
repeated-identity protection, cross-office denial and inactive/unapproved denial.
All disposable inventory and usage records were cleaned. Broader inventory UI,
counter and audit workflows remain pending. No production system was changed.

Combined installation rehearsal also PASS: all twelve QA repair migrations
install together, both new scripts reject execution without the QA environment
setting, and the pre-existing disabled EOD analytics trigger stays disabled.
No business rows are created by the repair migrations.
