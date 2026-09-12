# NDASH-082 — Fixed header intercepts eAssist detail close button

Section: RCM / eAssist Reports. Status: candidate verified; release pending.

Reproduced on frontend081 twice: open a report, click the drawer X; the drawer remains and the profile menu opens. Screenshot confirms the global fixed header covers the drawer title/X. Fresh reopen and DOM hit-test confirm the close-button center hits the header profile button. Drawer z-index50, fixed header100; all intermediate main containers have no intervening stacking context. The live stylesheet already contains z-[200] with z-index200.

Root cause and smallest fix: EAssistReportsTab.jsx DetailDrawer outer wrapper uses z-50 beneath the fixed header. Change only that class to the existing z-[200]. No other markup, callback, data, focus behavior or styles changed.

Verification before release: existing355 regression tests PASS; production build30.52s PASS; Rocket809 completed exact class change. The actual compiled drawer differs by one class only; callbacks/markup preserved, entire entry reverses to081, prior repairs and seven dependency relinks PASS. No extra style asset or stylesheet change needed. Backend080 unchanged;081 recovery graph retained. Live close-button hit-test and actual dismissal remain release gates.
