---
stage: 3
slug: 03-render-visual
pipeline: brand-image-gen
---
# Stage 3: Render Visual

## 1. Role & Objective
Execute stage **Render Visual** for pipeline **Brand-Aligned Image & Graphic Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Shared Config: `../../../../_config/visual-style.md`
- Previous Stage Output: `../02-brand-style-check/output/result.md`

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for final whiteboard rendering (`svg_graphic`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** Project final deliverable card onto the active Whiteboard Scope Section.
