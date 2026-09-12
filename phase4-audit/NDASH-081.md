# NDASH-081 — eAssist report office and parse status display blank

Section: RCM / eAssist Reports. Status: candidate verified; release pending.

Reproduced on frontend079: August All63 reports, first50 all blank Office/Parse Status; Brick21 reports, all21 blank after loading settled. API one-row contract check confirms office_canonical and parser_status exist and are nonempty, while office and parse_status are absent. The canonical office matches the selected Brick filter. No email content or record values were emitted.

Root cause: fetchEAssistDailyReports passes raw rows unchanged, but the existing table/detail/counter consumers read office and parse_status. Smallest fix: map each returned row preserving every field and add office (existing office then office_canonical) and parse_status (existing parse_status then parseStatus then parser_status). Envelope, diagnostics, financial values, ingestion, API, configuration and records unchanged.

Tests: three failures reproduced before across five synthetic service tests; all355 frontend tests pass after. Production build30.75s PASS; Rocket808 completed exact mapping. Actual production service function patched in one scoped expression; compiled before reproduces missing fields and after verifies canonical/legacy precedence, source field/envelope preservation, no mutation and empty response. Entire entry reverses exactly to079, all prior repairs and seven dependency relinks pass. Blocked042/066 excluded. Candidate index-73e7bb9deb35.js, SHA73e7bb9deb352b734e2f854df459e0754e33a4f357515299bc6dc6c58a13a0b8. Backend080 remains unchanged;079 rollback preserved.
