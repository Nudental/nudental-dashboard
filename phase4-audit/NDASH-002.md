# NDASH-002 — Executive subviews ignore selected date and location

Reproduced September 11, 2026 after NDASH-001 deployment: Overview Last Month (August 2026), Barnegat opened Monthly Growth on September 2026, All Offices. The August forecast also showed current September production and 13 remaining production days instead of the existing completed-period view. Repeated from all locations and the Barnegat selection.

Root cause: five JSX attributes in Executive Overview did not match existing child signatures. MonthlyGrowthTab accepts selectedOfficeIds, selectedMonth, selectedYear, but the parent supplied propOfficeIds, propMonth, propYear. Both MonthEndForecastWidget calls supplied monthYearProp while the component accepts monthYear. Undefined inputs invoked current-date/all-office fallbacks.

Fix: align those five call-site property names with existing child inputs. No calculations, data, authentication or deployment configuration changed. NDASH-001 is retained.

Tests: four actual source call-site/child-signature integration cases failed before and passed after; all nine cumulative regression tests pass. Frontend production build passes (31.97 seconds). Actual production component signatures and candidate bindings independently pass four cases; bundle syntax passes. Reversing the property edits returns exactly the previous production bundle. Seven other asset files and the payroll date offset are preserved.

Candidate asset: index-69f26cb396f0.js.
SHA256: 69f26cb396f0ab489805382b67b0ac92f7b5a259970dd621d2fd7c02ff9100b1.
Previous deployment/rollback: a997ce91-f82b-4220-946a-59106c11c4fb; /home/openclaw/.cache/nudashboard-audit-20260910/ndash001-dist-v2.

Deployment and live verification pending at this commit. Monthly Growth's legacy data completeness is a separate investigation; this change does not claim to repair its zero metrics.
