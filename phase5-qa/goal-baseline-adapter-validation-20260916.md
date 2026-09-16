# Isolated service-goal baseline adapter

The QA generator's initial preview for Office A / 2027 yielded no rows. Provider
aggregate routes remain deliberately closed, and the production location map
does not contain synthetic office IDs. This is missing QA integration, not a
claim that production has no baselines.

The QA-only API overlay substitutes two fixed read adapters for CDT-category and
patient aggregate routes. Only the existing Super Admin identity, one exact QA
office, complete months in 2026, and the synthetic category QA TEMP Preventive are
accepted. Unknown/operational IDs, unsupported dates, duplicate/extra parameters,
other roles and write methods are denied. Responses are labeled synthetic and
no-store. No provider, database business source, credential or network setting is
used or changed. The existing QA process sandbox remains mandatory.

The frontend generator sends the selected QA office UUID only in validated QA
mode; production continues using its existing location mapping. Three focused
frontend checks pass. The full retained QA backend suite passes 142 tests with
zero skips, including 13 new real FastAPI adapter tests and prior identity,
report-format, execution-intent and isolation checks. Positive, zero, missing,
cross-office and denied cases are covered. Hosted deployment and live generator
save/edit/cleanup verification are pending.
