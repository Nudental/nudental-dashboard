# Clinical stock/history access — applied in QA

PH5-AUTH-020. Two read-only live QA matrices reproduced access to the Office A synthetic stock row and its adjustment history by all 12 test identities, including Office B, inactive and unapproved accounts. Anonymous access returned zero. Both matrices left the exact rows unchanged. The existing read policies allow every authenticated user; the stock insert policy's WITH CHECK is also unrestricted.

Candidate 035 adds restrictive account/page/office boundaries to `office_supply_inventory` and `supply_inventory_history`, without adding role grants or replacing existing writer policies. Stock writes must identify the signed-in actor; history inserts must identify that actor and a matching accessible parent office. Service-role maintenance remains available.

90 actual PostgreSQL checks pass, including original read and cross-office-insert bypasses, 13-identity enforcement, authorized own-office reads/writes, other-office denial, actor-spoof denial, history/parent matching and unchanged original rows. The test works without unapplied 032 and 034. Installation verification passes 72 checks across 35 candidates; this is not a live migration count.

**Applied after explicit approval, September 16.** All thirteen live identities were checked; authorized reads preserve stock/history, and other identities cannot read or update the test stock. See [the consolidated live results](access-restrictions-live-20260916.md). Production is unchanged. The stock records remain for additional inventory testing and eventual cleanup preserving their history.
