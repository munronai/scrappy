---
stage: 1
slug: 01-prompt-spec
pipeline: brand-image-gen
---
# Stage 1: Prompt Spec

## 1. Role & Objective
Execute stage **Prompt Spec** for pipeline **Brand-Aligned Image & Graphic Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Shared Config: `../../../../_config/visual-style.md`
- User `@scrappy` prompt & scoped whiteboard context (`_prompts/ACTIVE_PROMPT.md`)

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for Stage 2 (`02-brand-style-check`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** `../02-brand-style-check/CONTEXT.md`
