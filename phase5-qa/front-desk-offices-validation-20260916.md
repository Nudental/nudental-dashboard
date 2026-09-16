# Front Desk synthetic QA office validation

PH5-QA-SUPPLY-007 — PASS in isolated QA, September 16, 2026.

The Office Manager catalog query failed twice with PostgreSQL 22P02: the
copied front_desk_office_location enum contained only production office names.
The service already selected the two synthetic offices correctly. Read-only
API checks reproduced rejection of both QA offices in both dependent tables;
both tables were empty before the repair.

Migration 031 adds QA / Office A and QA / Office B to the isolated enum and
restricts front_desk_inventory and front_desk_amazon_orders to those two names.
It leaves role policies unchanged and rejects installation outside QA. It does
not change the production enum, frontend, configuration or business data.

All 23 actual PostgreSQL filter/write/constraint checks and 64 installation
checks for 31 migrations pass. Source e87ade5 is pushed to the Phase 5 branch.
Applied SQL receipt: 96e537c6-4173-4413-bc9d-220a19a40b54 (saved and closed).
Four live API filters now succeed. Full browser reload and reopening Manage
Catalog clears the original enum error and shows the empty catalog. The Office
Manager then successfully creates one explicitly labeled QA catalog fixture;
its complete lifecycle, authorization and cleanup remain separate checks.

Existing QA frontend acf10c88 and production 1f1f91bc remain unchanged.
