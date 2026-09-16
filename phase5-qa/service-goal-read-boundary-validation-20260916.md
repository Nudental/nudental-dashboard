# Service-category goal office scope — live QA PASS

PH5-AUTH-022: two live matrices showed Office B staff and manager could read all
eleven temporary Office A service-category goals. Existing writes remained
admin/super-admin only; inactive and unapproved identities read zero rows.
Root cause: scg_select allowed every active user without the existing office
assignment check. This was a separate table from the previously repaired monthly
office_goals table.

Repair 042 adds one RESTRICTIVE SELECT policy requiring the established active
profile and user_can_access_office checks. It changes no role grants, stored goal
values, production policies or external execution. Twenty-three offline database
checks pass, including original leaks, regional/own-office visibility, explicit
assignment/revocation, inactive/unapproved/anonymous denial and original write
permissions. All 86 migration checks pass across 42 repairs, including rejection
outside QA and coexistence without seeding business data.

Applied only to hvtxjfayenqnwtaisoaw. Saved SQL query:
32dcffe0-e184-4ee6-bf1d-ab8f81564a45; confirmed RESTRICTIVE SELECT and saved state.
The repeated live twelve-identity matrix now gives Office B users zero Office A
goals, while authorized Office A and regional/admin users retain eleven. Existing
admin/super-admin writes still succeed; other writes stay denied. Goal contents
are unchanged. Browser readback and subsequent null/edit/restore tests pass.

All eleven goal fixtures are cleaned with fourteen audit entries retained.
Private evidence is in qa-service-goals-20260916.json. Database-only QA repair;
no further frontend/API/production deployment needed.
