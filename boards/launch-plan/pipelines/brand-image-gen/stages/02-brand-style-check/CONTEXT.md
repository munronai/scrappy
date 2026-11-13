---
stage: 2
slug: 02-brand-style-check
pipeline: brand-image-gen
---
# Stage 2: Brand Style Check

## 1. Role & Objective
Execute stage **Brand Style Check** for pipeline **Brand-Aligned Image & Graphic Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Shared Config: `../../../../_config/visual-style.md`
- Previous Stage Output: `../01-prompt-spec/output/result.md`

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for Stage 3 (`03-render-visual`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** `../03-render-visual/CONTEXT.md`
