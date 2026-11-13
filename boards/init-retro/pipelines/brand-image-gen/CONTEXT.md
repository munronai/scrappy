---
id: brand-image-gen
title: "Brand-Aligned Image & Graphic Pipeline"
description: "Generates brand-consistent hero graphics, illustrations, and architectural visuals governed by _config/brand-guidelines.md and _config/visual-style.md."
triggers: ["image","graphic","illustration","hero","visual","draw","art","banner","poster","icon","diagram"]
configs: ["_config/brand-guidelines.md","_config/visual-style.md"]
stages: ["01-prompt-spec","02-brand-style-check","03-render-visual"]
outputWidgetType: svg_graphic
---
# ICM Pipeline: Brand-Aligned Image & Graphic Pipeline

> Generates brand-consistent hero graphics, illustrations, and architectural visuals governed by _config/brand-guidelines.md and _config/visual-style.md.

## Shared Configuration Inputs (`_config/`)
- [`_config/brand-guidelines.md`](../../_config/brand-guidelines.md)
- [`_config/visual-style.md`](../../_config/visual-style.md)

## Stage Sequence (Execution Order)
1. [`stages/01-prompt-spec/CONTEXT.md`](./stages/01-prompt-spec/CONTEXT.md)
2. [`stages/02-brand-style-check/CONTEXT.md`](./stages/02-brand-style-check/CONTEXT.md)
3. [`stages/03-render-visual/CONTEXT.md`](./stages/03-render-visual/CONTEXT.md)

## Cold-Agent Walk Contract
1. Read the shared `_config/` files listed above.
2. Execute each stage in `stages/01-...` through `stages/0N-...` sequentially.
3. Write each stage artifact to `stages/<stage>/output/result.md` and project the final deliverable onto the whiteboard scope.
