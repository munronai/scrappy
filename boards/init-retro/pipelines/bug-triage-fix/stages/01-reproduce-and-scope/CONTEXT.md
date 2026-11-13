---
stage: 1
slug: 01-reproduce-and-scope
pipeline: bug-triage-fix
---
# Stage 1: Reproduce And Scope

## 1. Role & Objective
Execute stage **Reproduce And Scope** for pipeline **ICM Bug Triage & Resolution Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- User `@scrappy` prompt & scoped whiteboard context (`_prompts/ACTIVE_PROMPT.md`)

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for Stage 2 (`02-root-cause-plan`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** `../02-root-cause-plan/CONTEXT.md`
