# Clinical stock/history access — candidate only

PH5-AUTH-020. Two read-only live QA matrices reproduced access to the Office A synthetic stock row and its adjustment history by all 12 test identities, including Office B, inactive and unapproved accounts. Anonymous access returned zero. Both matrices left the exact rows unchanged. The existing read policies allow every authenticated user; the stock insert policy's WITH CHECK is also unrestricted.

Candidate 035 adds restrictive account/page/office boundaries to `office_supply_inventory` and `supply_inventory_history`, without adding role grants or replacing existing writer policies. Stock writes must identify the signed-in actor; history inserts must identify that actor and a matching accessible parent office. Service-role maintenance remains available.

90 actual PostgreSQL checks pass, including original read and cross-office-insert bypasses, 13-identity enforcement, authorized own-office reads/writes, other-office denial, actor-spoof denial, history/parent matching and unchanged original rows. The test works without unapplied 032 and 034. Installation verification passes 72 checks across 35 candidates; this is not a live migration count.

**NOT APPLIED.** The user has been asked to approve the expanded group 032/034/035. Only 032 was previously rejected by automatic approval review for requiring explicit access-control authorization; 034/035 have not been attempted. Live post-repair checks remain pending. Production is unchanged.
