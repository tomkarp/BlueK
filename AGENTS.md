# BlueK development

- Maintain `docs/regression-checklist.md` when changing GUI or runtime behavior.
  Preserve stable IDs and distinguish user confirmation, helper/runtime tests,
  actual browser tests, and untested visual acceptance.
- For regression fixes, add or extend a meaningful behavior test where practical.
  Run affected tests and record actual results, including failures or blockers.
- Svelte is the only maintained frontend. Preserve its existing architecture
  unless the user explicitly requests architectural changes.
- The user prioritizes clear ownership and narrow typed interfaces. Follow
  `docs/architecture.md`; keep runtime state authoritative and derive UI views
  instead of maintaining duplicate copies.
- Current focus is BlueK without BluePlay classes; keep template creation available.
- Do not commit or push without an explicit request.
