# NDASH-066 — Year comparison percentage columns refer to the wrong years

Section: shared Year Comparison panel, reproduced in RCM. Severity: Medium. Status: tested candidate; live verification pending.

Reproduction on065:2026/2025/2024 table headings put changes after older years, yielding Net Production cells999777/6580370/+6.2%/6194896/% under headings2026/2025/vs2026/2024/vs2025. Reset/reselect2025+2024 reproduces a bare% with headingsMetric/2025/2024/vs2025, concealing the valid+6.2%change.

Root cause: buildComparisonKPIRows correctly stores changes[newerYear] relative to the next older selected year. Table JSX wrongly renders change columns only for idx>0 and labels them against idx-1. Smallest fix: both header/body guards become idx<sortedYears.length-1; header baseline becomesidx+1. Underlying data, calculations, colors, annual cards, chart065, date filters, permissions and payroll unchanged.

Verification: actual JSX synthetic regression3failures before;297frontendtestsPASS after; production build31.26sPASS. Actual compiled table7207bytes changes only3expressions; two/three-year rendered headings and cells plus missing-change dashPASS. Full reversalto065/priorrepairs/sevenrelinksPASS. Rocket796 completed matching source changes. Candidateindex-6e462758778f.js; expected prior deployment8afdd341-91fb-4509-9727-76d98c62b03e. No businesswrites, exports, provider sync or backend/config changes. BLOCKED004legacy financial-source completeness remains separate.
