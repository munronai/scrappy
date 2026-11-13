---
name: icm-architect
description: >-
  Use this skill to compile Scrappy Whiteboard brainstorms or Scope Sections into
  Interpretable Context Methodology (ICM) pipelines (`RinDig/icm-architect`),
  inspect top-level routing markdown (`boards/<name>/CONTEXT.md`), or run the
  Cold-Agent Walk Test.
---

# `icm-architect` — Compile Whiteboard Brainstorms into ICM Pipelines

This skill integrates [`RinDig/icm-architect`](https://github.com/RinDig/icm-architect) with **Scrappy Whiteboard**.

## Core Capabilities

1. **Inspect Top-Level ICM Routing Table & Registered Pipelines (`CONTEXT.md`):**
   ```bash
   npm run wb -- pipelines --board launch-plan
   ```
   Or test which ICM pipeline matches a `@scrappy` prompt:
   ```bash
   npm run wb -- pipelines --board launch-plan --prompt "generate a brand hero image"
   ```

2. **Compile a Whiteboard Scope Section or Brainstorm into an ICM Pipeline:**
   ```bash
   npm run wb -- build-pipeline --board launch-plan --section sec-01-discovery --title "Customer Research Pipeline" --triggers "research,interview,discovery"
   ```
   This:
   - Orders the cards inside the target Scope Section topologically.
   - Scaffolds numbered ICM stage directories under `boards/launch-plan/pipelines/<slug>/stages/01-.../CONTEXT.md` with explicit **Role**, **Required Inputs** (including `_config/brand-guidelines.md`), **Process**, and **Output Contract**.
   - Registers the new pipeline in the top-level routing file `boards/launch-plan/CONTEXT.md`.
   - Projects the compiled pipeline stages back onto the whiteboard canvas and runs the **Cold-Agent Walk Test**.

3. **Run the Cold-Agent Walk Test:**
   ```bash
   npm run wb -- walk-test --board launch-plan
   ```
   Verifies that a cold agent with zero prior memory can start at `boards/launch-plan/CONTEXT.md` and walk every stage of every registered pipeline with zero broken references.
