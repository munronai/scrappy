---
id: bug-triage-fix
title: "ICM Bug Triage & Resolution Pipeline"
description: "Turns bug reports or checklist items into root-cause analysis, fix implementation cards, and a verified QA checklist."
triggers: ["bug","bugs","fix","triage","issue","broken","qa","resolve"]
configs: ["_config/brand-guidelines.md"]
stages: ["01-reproduce-and-scope","02-root-cause-plan","03-verification-checklist"]
outputWidgetType: checklist
---
# ICM Pipeline: ICM Bug Triage & Resolution Pipeline

> Turns bug reports or checklist items into root-cause analysis, fix implementation cards, and a verified QA checklist.

## Shared Configuration Inputs (`_config/`)
- [`_config/brand-guidelines.md`](../../_config/brand-guidelines.md)

## Stage Sequence (Execution Order)
1. [`stages/01-reproduce-and-scope/CONTEXT.md`](./stages/01-reproduce-and-scope/CONTEXT.md)
2. [`stages/02-root-cause-plan/CONTEXT.md`](./stages/02-root-cause-plan/CONTEXT.md)
3. [`stages/03-verification-checklist/CONTEXT.md`](./stages/03-verification-checklist/CONTEXT.md)

## Cold-Agent Walk Contract
1. Read the shared `_config/` files listed above.
2. Execute each stage in `stages/01-...` through `stages/0N-...` sequentially.
3. Write each stage artifact to `stages/<stage>/output/result.md` and project the final deliverable onto the whiteboard scope.
