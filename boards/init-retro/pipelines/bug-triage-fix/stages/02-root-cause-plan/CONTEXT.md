---
stage: 2
slug: 02-root-cause-plan
pipeline: bug-triage-fix
---
# Stage 2: Root Cause Plan

## 1. Role & Objective
Execute stage **Root Cause Plan** for pipeline **ICM Bug Triage & Resolution Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Previous Stage Output: `../01-reproduce-and-scope/output/result.md`

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for Stage 3 (`03-verification-checklist`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** `../03-verification-checklist/CONTEXT.md`
