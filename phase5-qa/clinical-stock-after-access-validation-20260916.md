# Clinical stock after approved access restrictions

On the isolated QA frontend, the synthetic six-unit catalog stock was adjusted
to seven with a labeled test note and Physical Count Correction, then restored
to six using Remove Stock. The UI reports success. Full reload shows the saved
quantity at both stages; one inventory ID remains. Audit history grows from
nine to eleven events, with exact +1 (6 to 7) and -1 (7 to 6) entries attributed
to QA Super Admin. Both entries are visible in the UI history panel. No provider
or purchasing action occurred. This is positive super-admin verification after
restriction 035; it does not substitute for a new ordinary-role UI session.

The completed synthetic clinical monthly request and its one line are removed;
all four original audit events remain. Repeat cleanup removes zero records and
the refreshed UI shows No monthly requests yet. All temporary Front Desk and
urgent request fixtures are also cleaned.

The three stock scenarios are intentionally retained as reusable QA fixtures:
six in-stock, five low, two critically low. They preserve fourteen history
events, including original reproduction evidence. Deleting stock would cascade
that evidence. The user permits reusable synthetic fixtures; exact IDs and
retention purpose are recorded in `reusable-clinical-fixtures-20260916.json`.
No production or fixture database records were changed merely to record this
retention decision.
