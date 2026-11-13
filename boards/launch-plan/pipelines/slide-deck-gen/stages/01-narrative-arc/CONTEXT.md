---
stage: 1
slug: 01-narrative-arc
pipeline: slide-deck-gen
---
# Stage 1: Narrative Arc

## 1. Role & Objective
Execute stage **Narrative Arc** for pipeline **Executive Slide & Narrative Deck Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- User `@scrappy` prompt & scoped whiteboard context (`_prompts/ACTIVE_PROMPT.md`)

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for Stage 2 (`02-slide-breakdown`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** `../02-slide-breakdown/CONTEXT.md`
