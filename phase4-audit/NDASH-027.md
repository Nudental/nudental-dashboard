# NDASH-027 — Employee filters left the list on an empty later page

- Section: Payroll / Imported from Gusto / Employees. Severity: Medium.
- Reproduced live after026: page2 shows employees51–100 of164; switching to Active keeps offset50 although only30 rows match, and falsely says no employees were imported.
- Root cause: filter changes update only filter state, retaining pagination. The filtered-empty view uses an import-inventory message.
- Smallest fix: reset page to0 in the existing filter callback before setting filters; describe an empty filtered result accurately. Two lines in GustoEmployees.jsx, no query/business-data changes.
- 82 retained tests PASS; source production build PASS27.70s; actual deployed callback three scenarios, syntax and exact reversal PASS. Deployment88a7b3c2-d838-4cf3-894c-59f2459ddbf3, asset index-682fe2bd5ac6.js, SHA256682fe2bd5ac630323516659eb5cbc8070df0f628f534db6e5083bb0e3aabe916. Previous025 release preserved. Rocket759.
- Live PASS: from page2 (51–100/164), Active resets to1–30/30. No-match search shows “No employees match the current filters.” and disabled export; test text cleared. No records created or modified.
