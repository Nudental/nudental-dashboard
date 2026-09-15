# PH5-HUDDLE-004 — simultaneous first load leaves creation error on a valid draft

Hosted QA had no Huddles. Navigating to Morning Huddle as the ordinary office
manager created today's draft but showed duplicate key value violates unique
constraint idx_huddles_office_date instead of the editor. Reopening recovered the
single draft with four provider blocks, nineteen checklist items and one creation
event. A QA TEMP label then saved in prev_day_wrong with one edit event.

Root cause: getOrCreateHuddleForDate performs a read followed by insert, and two
overlapping calls can both see no row. The unique office/date constraint prevents
duplicates, but the losing call surfaced an error. The targeted fix handles only
23505 by reading that same office/date again and returning the row if accessible.
Other failures stay visible; no default children or create event are written by
the losing caller. No schema/permission changes or production calls.

Seven actual-service cases: five PASS/two FAIL before the repair. Covers concurrent
creation, normal/existing draft, default child counts, permission/read failures,
missing conflicting row and denied recovery. Build and live repeat pending.

All seven focused cases PASS; all 1206 retained frontend/production-parity tests
PASS, no skips. QA build/source/environment validation PASS. Entry
index-DKzXh5P5.js, 8,826,819 bytes, SHA256
118fbdc990130d5e10013e0c880cc03d26f80c5618ae425487171dd3c0e30ddf.
Archive SHA256 f640a15445b5220f42514d2cc03fd7c908638890751e24ef044b9740813b3de5.

QA deployment bdf04822-2a60-46ba-8d98-3e46e80f7b5b from
15be4ed7ae912f86404d5231d0e25813d730fd60 succeeded; all 17 hosted checks PASS.
Original labeled draft and its own four blocks/nineteen checklist items were
cleaned; the two original audit events were preserved in the evidence file before
normal cascade cleanup. Repeating first load from an empty QA Huddles table
opened Draft without a duplicate error. Exactly one Huddle, four provider blocks,
nineteen checklist items and one creation event exist. QA TEMP label saved with
one edit event. New temporary draft b8b304b1-0815-4ce2-baba-fdfc6f13ddf9 is retained
for the next bounded workflow tests and tracked in its private-workspace manifest;
cleanup remains due after those tests. Production remains unchanged.
