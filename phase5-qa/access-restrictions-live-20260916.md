# Four approved QA access restrictions — live verification

The user explicitly approved repairs 032, 034, 035 and 039 on September 16. Each was applied separately to `hvtxjfayenqnwtaisoaw`, with an exact-project/schema-batch-26 guard, then checked before the next migration. No production policy, role grant, identity, provider or configuration changed. The prior automatic-review block on 032 was resolved by this explicit approval.

| Repair | Live verification | Preserved behavior | Saved SQL receipt |
|---|---|---|---|
| 032 Front Desk catalog | All 12 identities checked; Office A manager and Super Admin read the labeled Office A record, other ten read zero and cannot update it | Exact record unchanged; UI still shows six units under Office A | `15fb1dc4-34d9-45e0-a80b-55d29a499ef3` |
| 034 Amazon history | All 12 identities plus anonymous checked; only the two permitted identities read/update the test record | Authorized no-op updates preserve the exact row; history UI renders the single zero-dollar Closed/Not Received record | `bc6cb2b1-99e3-4d68-8aa3-fb319c2d47ed` |
| 035 Clinical stock/history | All 12 identities plus anonymous checked; only the two permitted identities read the Office A stock and nine history rows; other identities cannot update the stock | Exact stock/history snapshots unchanged; UI still shows the three synthetic quantities 2, 5 and 6 | `4748a75a-43b9-4804-b227-96946588dba4` |
| 039 Urgent requests | All 12 identities plus anonymous checked; only the two permitted identities read the Office A request and three audits; other identities cannot update it | Exact record/audits unchanged; existing owner/admin policy still applies to writes | `d54d28d8-6fc3-407b-961b-6feeb7904584` |

The identity expectations follow the current fixture permissions, including page grants; this does not mean every production Admin or Regional Manager is denied. No roles were granted merely to make tests pass. Detailed denial/positive create/edit coverage also remains in the four offline PostgreSQL suites (47, 78, 90 and 81 checks respectively). All 80 installation checks across 39 migrations pass. Positive post-restriction clinical stock mutation is not claimed by the read/denied-write matrix.

Cleanup after successful scope verification removed only the exact labeled catalog, Amazon and urgent simulation records. Their histories remain: seven catalog audit entries, one order audit and four urgent audit entries. Repeated deletion returned zero records with unchanged histories. The urgent list refresh shows no requests, and its two private notification simulations remain exactly one mocked email and one mocked SMS intent after deletion. Clinical stock is still retained for remaining inventory tests; its cascading history relationship requires preservation during eventual cleanup.

Evidence outside the repository: `qa-frontdesk-catalog-scope-after-20260916.json`, `qa-frontdesk-amazon-scope-after-20260916.json`, `qa-clinical-stock-scope-after-20260916.json`, `qa-urgent-access-after-20260916.json`, and the three updated fixture cleanup receipts. Existing before/reproduction receipts remain intact. Do not rerun helpers that require these deleted fixtures.

QA frontend remains `80c69cdc-8ebb-4f18-aece-d25364965521` / source `847c1c6cbe01640753fa741c957215b8860ca710`; no new frontend release was needed. Production remains `1f1f91bc-5dbd-4500-8bfd-d4e2039ba601`, and canonical main is unchanged.
