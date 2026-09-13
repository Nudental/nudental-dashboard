# NDASH-115 — Set Goals mislabels production goals as collection targets

Twice reproduced live114 in Settings: heading Monthly Collection Targets and instruction Set monthly collection targets for each office alongside four Enter production goal inputs. Current handler/service persist production_goal/monthly_target; collection goal is separately derived. No values edited or Save clicked.

Three exact label changes only in GoalsManagement.jsx and management/index.jsx: production goals in heading, instruction, navigation description. Calculations, queries, inputs, save handlers and data untouched. Rocket841 confirmed. Build32.41sPASS/all519retained regressionsPASS. Exact three-string release patch plus seven module relinks fully reverses to114; syntax and unchanged modulesPASS. Anonymous pre-release four-input signature1589279262. Candidateindex-b2eddb4c8ea8.js;deployment/livepending.

Classification: Section Settings / Set Goals. Severity Low: conflicting labels around an existing production-goal field. Expected labels match the value being edited; actual collection wording.

CLOSED PASS: source6f829d3/deployment285aa6e0-aef8-4ddf-a2be-6a3700ba77ea/index-b2eddb4c8ea8.js SHAb2eddb4c8ea82f4b518ceb343f105ecdb078354075305f27bf1b33a0a3634487. Allthreecorrectlabels live;Septemberfourinputs signature1589279262 unchanged;Save disabled;Octoberlabel thenSeptemberrestore/samevalues PASS. Newerrors0/frontendAPI200/three services/backend113 unchanged.114recoverypreserved;no real/testdata modified.
