# Scrappy Whiteboard — Comprehensive User Guide

A step-by-step guide to using **Scrappy Whiteboard** with **Antigravity CLI (`agy`)**, **Claude Code**, or standalone model APIs in **under 5 minutes**.

---

## ⏱️ Quick Navigation

- [Minute 1: Start the Whiteboard Server & Board Switcher](#minute-1-start-the-whiteboard-server--board-switcher)
- [Minute 2: Canvas Ergonomics (Pointer Marquee, Hand Pan, Freeform Text & Shortcuts)](#minute-2-canvas-ergonomics-pointer-marquee-hand-pan-freeform-text--shortcuts)
- [Minute 3: Connector Lines (Styles, Labels & Inspector)](#minute-3-connector-lines-styles-labels--inspector)
- [Minute 4: Interactive UI Library (Checklists, Mermaid, Tables & Image Paste)](#minute-4-interactive-ui-library-checklists-mermaid-tables--image-paste)
- [Minute 5: Right-Click `@scrappy` & Bottom Dock ("Ask @scrappy" Cmd+K)](#minute-5-right-click-scrappy--bottom-dock-ask-scrappy-cmdk)
- [Minute 6: Clean Board Initializer, Templates & Multi-Board Management](#minute-6-clean-board-initializer-templates--multi-board-management)
- [Minute 7: Compile Brainstorms into ICM Pipelines (`icm-architect`)](#minute-7-compile-brainstorms-into-icm-pipelines-icm-architect)
- [Minute 8: Glass-Box ICM File Inspection & Integrations](#minute-8-glass-box-icm-file-inspection--integrations)

---

## Minute 1: Start the Whiteboard Server

In your terminal:
```bash
cd /Users/munron/scrappy
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

You will see the default **Product Launch Whiteboard (`launch-plan`)** featuring:
- **Scope Sections** (`01. Discovery & Goals`, `02. Architecture & Flow`, `03. Launch Checklist & Integrations`).
- **Interactive Checklist Cards**, **Live Mermaid Diagrams**, and **Artistic Concept Graphics**.
- **Directed SVG Connector Lines** with editable labels and style modes.
- **Collapsible Right-Hand Panel** (`◂ @scrappy Queue` / `▸ Collapse Panel`).

---

## Minute 2: Canvas Ergonomics (Resize Corners, Scope Locking & Colors)

### 1. Pointer Tool (`↖`) vs. Hand Tool (`✋`)
- **`↖` Pointer Tool (`V` or `1`):**
  - Left-click and drag across any empty canvas area to draw an animated **Selection Marquee Box**. All cards and shapes intersecting the box become multi-selected.
  - Clicking on an empty canvas area clears the active selection.
- **`✋` Hand Tool (`H` or `2`):**
  - Left-click and drag anywhere on the canvas to pan the viewport smoothly.
  - **Quick Pan:** You can hold down the `Spacebar` or use middle mouse click at any time to pan regardless of active tool.
- **Zoom:** Use two-finger trackpad pinch, `Cmd + Scroll`, or the `−` / `+` zoom controls in the top-right toolbar.

### 2. Freeform Text Box (`T`)
- Press **`T`** or click **`T`** in the bottom dock to place a **Freeform Text Box** directly on the canvas surface.
- Appears completely flat without card borders, shapes, or sticky backgrounds.
- Double-click to edit text inline; supports full Markdown formatting (`# Headers`, `**bold**`, bullet lists).
- Hover over the text to change its font color via the mini action toolbar (`🎨`).

### 3. Flat Ergonomics & Corner Resizing
- **Clean Flat Cards:** Content items (cards, checklists, tables, diagrams) appear flat on the board without harsh borders. Sections retain clean structural borders.
- **Corner Resizing:** Corner resize handle squares are turned off by default to eliminate visual clutter. Hovering near any corner changes your mouse pointer to diagonal resize arrows (`nwse-resize`, `nesw-resize`), allowing you to grab and resize immediately.
- **Contextual Hover Toolbars:** Action buttons (colors, section locking, JSON inspector, deletion) stay hidden until you hover over an object, appearing in a floating mini-toolbar above the card or section.
- **`👁️ View` Menu Settings:** Use the **`👁️ View ▾`** dropdown in the top bar to toggle card borders, corner resize squares, and metadata badges.

### 4. Floating Bottom Icon Dock & Quick Prompt Bar
- A sleek, floating dock at the bottom center of the screen provides 1-click access to all creation tools:
  - **`↖` Pointer Tool (`V` / `1`):** Marquee multi-selection.
  - **`✋` Hand Tool (`H` / `2`):** Smooth canvas panning.
  - **`T` Freeform Text:** Direct text object on canvas.
  - **`#` Scope Section:** Add grouped stage frame.
  - **`📝` / `⬜` / `☑️` / `📊` / `📋` / `🖼️`:** Add stickies, shapes, checklists, mermaid diagrams, tables, and images.
  - **`✨ Ask @scrappy` (`Cmd+K`):** Toggles the floating "Describe a change" quick prompt bar.

### 3. Scope Locking (`🔒`)
- Cards created inside or dragged into a Scope Section are **automatically locked to that section**.
- **Move with Section:** When you drag a Scope Section by its header, all locked child cards move with it.
- **Resize with Section:** When you resize a Scope Section via its corners, all locked child cards resize and reposition proportionally!
- **Toggle Lock:** Click the `🔒` / `🔓` button in a card's top-right corner to lock or unlock it from the section.

### 4. Card Color Selector (`🎨`)
- Click the `🎨` button in any card's header to open the color palette popover (`Yellow`, `Mint Green`, `Sky Blue`, `Lavender`, `Pink`, `Peach`, `Teal`).
- Selecting a color updates the card on the canvas and persists to `sections/<slug>/nodes/<id>.md`.

---

## Minute 3: Connector Lines (Styles, Labels & Inspector)

### 1. Connecting Cards
- Hover over the right edge of any card to reveal the blue **`→`** connector handle.
- Drag from the circle to any target card to draw a connector arrow.

### 2. Default Connector Style
- In the top bar, use the **Connector Style Dropdown** to choose the default style for newly drawn lines:
  - **`─ Solid Line (Persistent)`**: Clean grey line representing fixed architectural connections.
  - **`┄ Dashed Line`**: Dashed line for dependencies or optional branches.
  - **`⋯ Animated Blue Line`**: Glowing flowing dots representing live runtime flows.

### 3. Connector Line Inspector & Label Editor
- **Click any connector line** (or its label pill) on the canvas to open the floating **Connector Line Inspector**.
- **Edit Label:** Type a label (e.g. `persisted via`, `triggers`, `blocks`) and press Enter.
- **Switch Style:** Toggle between Persistent Grey, Dashed, and Animated Blue Flow.
- **Delete Line:** Click **`Delete Line`** to remove the connection.

---

## Minute 4: Interactive UI Library (Checklists, Mermaid & Image Paste)

Scrappy Whiteboard's **`@scrappy/ui-library`** provides ready-made, persistent controls that survive restarts:

### 1. Interactive Checklist Card (`☑️ + Checklist`)
- Click **`☑️ + Checklist`** in the top bar (or ask `@scrappy create a checklist`).
- **Interactive Checkboxes:** Click any checkbox `[ ]` / `[x]` to mark items complete.
- **Inline Add / Remove:** Type into the `+ Add bug or task...` field to add items; click `✕` to delete an item.
- **Action Open Items:** Click **`⚡ Action Open w/ @scrappy`** in the checklist header. `@scrappy` automatically reads the unchecked items, plans fixes, and drops connected action cards right next to the checklist!
- **Persistence Across Restarts:** Checklist items are saved in the node's YAML frontmatter and synced with `- [ ]` / `- [x]` markdown lines in the file.

### 2. In-Place Mermaid Diagram Shape (`📊 + Mermaid`)
- Click **`📊 + Mermaid`** (or ask `@scrappy create a mermaid diagram`).
- The diagram compiles and renders **directly on the canvas as an SVG diagram**.
- Click **`✏️ Edit Mermaid`** (or double-click the diagram) to switch to the live markdown editor.
- Click **`✓ Render Diagram`** to compile changes back into an SVG.

### 3. Clipboard Image Paste & Image Cards (`🖼️ + Image`)
- Press **`Cmd+V` / `Ctrl+V`** anywhere on the canvas to immediately paste an image from your clipboard as an Image Card!
- Or click **`🖼️ + Image`** in the toolbar to enter an image URL or upload a file.

### 4. Artistic SVG Graphics (Generated via `@scrappy`)
- Rather than inserting a static stock image, graphics on the board are generated dynamically by the agent.
- Right-click anywhere on the canvas and summon `@scrappy create an artistic graphic of ...` (or click the **`🎨 @scrappy artistic graphic`** quick-prompt pill in the dialog).
- `@scrappy` generates bespoke, multi-layered vector graphics, architecture flows, and visual metaphors tailored to your context, brand guidelines, and prompt.

### 5. Interactive Table Component (`📋 + Table`)
- Click **`📋 + Table`** in the top bar (or ask `@scrappy create a comparison table with pros and cons`).
- **4 In-Card Modes:**
  - **`👀 View`**: Renders as an HTML table styled to the board's dark theme by default (or with custom styled themes).
  - **`✏️ Visual Grid`**: Visually build and edit tables by clicking **`+ Col`**, **`+ Row`**, deleting rows/columns with **`✕`**, and editing cell contents in-place.
  - **`📝 Markdown`**: Directly view or paste standard Markdown tables (`| Col 1 | Col 2 |`). Click **`✓ Parse & Render`** to convert raw markdown into an interactive table with instant validation.
  - **`🎨 Style Designer (Natural Language CSS)`**: Customize the appearance without knowing CSS. Enter descriptions like *"zebra stripes with sky blue header, compact font, and rounded borders"*, pick quick color presets (Sky, Emerald, Amber, Purple, Minimal, Rounded), and preview the generated CSS reference snippet live.
- **Dual Markdown & YAML Persistence:** The table's structured data is saved in YAML frontmatter (`tableData`), and standard markdown table syntax is automatically formatted into the node's `.md` file body so external tools and agents can read and write the table as plain markdown.

---

## Minute 5: Right-Click `@scrappy` & Top-Level ICM Pipeline Routing

### 1. Right-Click to Summon `@scrappy`
- **Right-click anywhere on the canvas** (or directly inside a Scope Section or card) to open the `@scrappy` dialog anchored to your cursor.
- Type your prompt or click **`🎙️`** to use voice dictation.

### 2. Top-Level ICM Pipeline Detection (`CONTEXT.md`)
As you type your request, Scrappy Whiteboard scans the workspace's root `CONTEXT.md` routing table and displays the **Execution Route Selector**:
- **`🎯 Run ICM Pipeline` (Auto-matched when keywords match):**
  - If you type `generate a hero image`, it matches the **`Brand-Aligned Image & Graphic Pipeline`** (`pipelines/brand-image-gen/CONTEXT.md`).
  - If you type `slide deck`, it matches **`Executive Slide & Narrative Deck Pipeline`**.
  - If you type `video script`, it matches **`Video Script & Storyboard Pipeline`**.
  - If you type `fix bugs`, it matches **`ICM Bug Triage & Resolution Pipeline`**.
  - Running a pipeline enforces the governance and quality rules from `_config/brand-guidelines.md` and `_config/visual-style.md`.
- **`🧠 Let Agent Decide`:** Executes as a standard freeform `@scrappy` action.
- **`🏗️ Build Pipeline`:** Opens the ICM Architect modal to turn your prompt into a brand-new pipeline.

### 3. Scoped Coordinates & Token Discipline
- Prompts automatically inherit the **Target Scope Section** and **Focus Region Bounding Box**.
- Newly created cards are placed **strictly inside the target scope**, expanding section borders automatically if needed.

### 4. Executing via Antigravity CLI (`agy`) or Standalone API
- **In ICM Mode (`📂 ICM Mode`):**
  Click **`Write ICM ↵`**. A purple pin appears on the canvas and the task contract is written to `boards/launch-plan/_prompts/ACTIVE_PROMPT.md`.
  In your terminal / `agy` session, execute:
  ```bash
  npm run wb -- update-scrappy --board launch-plan
  ```
- **In Standalone Mode (`☁️ Model API`):**
  Click **`Run API ↵`** to send the request directly to the configured LLM API (Gemini, Claude, OpenAI) and render the cards immediately.

---

## Minute 6: Clean Board Initializer, Templates & Multi-Board Management

Scrappy Whiteboard provides full multi-board workspace storage and template support:

### 1. Board Switcher Dropdown (Top Bar)
- Click the **Board Title** in the top bar (`Product Launch & Architecture Whiteboard ▾`) to open the board switcher.
- Instantly switch between saved boards (`boards/launch-plan`, `boards/sprint-4-retro`, etc.) without losing your workspace state.
- Each board displays its slug, display title, and object count.

### 2. Start a Clean Board (`✨ Start Clean Board...`)
- Need a fresh canvas without manually deleting cards or overwriting existing work?
- Click the board switcher dropdown and select **`✨ Start Clean Board...`**.
- Enter a slug (e.g. `q1-brainstorm`) and title. The whiteboard creates an empty canvas with 0 cards and 0 sections, ready for a clean thinking session.

### 3. Board Template Gallery (`📋 Start from Template...`)
Choose from 4 ready-made architectural templates:
- **🌟 Clean Board:** 100% empty canvas.
- **🚀 Product Launch Plan:** 3-stage ICM structure (Discovery, Architecture, Launch).
- **🏗️ ICM Pipeline:** 4-stage sequential workflow (Requirements Brief, Research & Style, Generation, Review & QA Gate).
- **🔄 Sprint Retrospective:** 3 columns (What Went Well, Challenges & Gaps, Action Items).

### 4. Save Board As / Duplicate (`💾 Save Board As...`)
- Clone any active board into a new independent directory under `boards/<new-slug>/` with all cards, sections, layouts, and markdown files preserved.

### 5. Mount on Existing ICM Workspaces (Auto-Layout Detection)
- You can mount Scrappy Whiteboard on top of any existing ICM workspace folder on disk (`boards/<existing-name>/`).
- If no `_layout.json` exists, the adapter **auto-detects existing `stages/` or `sections/` folders and node files**, generating an organized spatial layout on the fly!

### 6. Reload from Disk (`🔄 Reload from Disk`)
- Click **`🔄 Reload from Disk`** in the switcher dropdown to force a full re-read of all `.md` files and `_layout.json` from the filesystem.

---

## Minute 7: Compile Brainstorms into ICM Pipelines (`icm-architect`)

Turn a messy whiteboard brainstorm into a production-ready, agent-walkable ICM pipeline in seconds:

1. **Launch the Architect Studio:**
   - Click **`🏗️ Build ICM Pipeline`** in the top toolbar, **OR**
   - Click **`🏗️ → ICM Pipeline`** on the header of any Scope Section.
2. **Configure Pipeline:**
   - Set the **Pipeline Name** (e.g., `Customer Discovery Pipeline`).
   - Pick the target Scope Section (or entire board).
   - Choose the expected deliverable widget type (`svg_graphic`, `checklist`, `mermaid`, or `sticky`).
3. **Compile (`🏗️ Compile ICM Pipeline`):**
   - Synthesizes numbered stage folders (`01-brief/`, `02-style/`, etc.) with `CONTEXT.md` contracts.
   - Registers the pipeline in the top-level routing file (`boards/<name>/CONTEXT.md`).
   - Automatically runs the **ICM Cold-Agent Walk Test** to ensure zero broken references.
4. **Inspect Pipeline Files:**
   - Click **`📂 Open ICM Drawer`** to inspect the generated markdown contracts directly inside the whiteboard.

---

## Minute 8: Glass-Box ICM File Inspection & Integrations

- **Collapsible Right Drawer (`◂` / `▸`):** Toggle the drawer at any time for maximum whiteboard canvas space.
- **`📂 ICM Files` Tab:** Browse and read raw `.md` stage contracts and node frontmatter.
- **`🐚 /update-scrappy` Tab:** View pending prompts and execution history.
- **`💾 Export Board`:** Export the board (or any section) to a single PRD Markdown doc or Mermaid diagram.
   - Define **Trigger Keywords** (e.g., `research, interview, customer`).
   - Select the **Output Widget Type** (`Artistic SVG Graphic`, `Interactive Checklist`, `Mermaid Diagram`, or `Stage Cards`).
3. **Compile + Walk Test:**
   - Click **`🏗️ Compile ICM Pipeline + Walk Test`**.
   - Scrappy Whiteboard automatically:
     - Scaffolds numbered stage folders: `boards/launch-plan/pipelines/<slug>/stages/01-.../CONTEXT.md`.
     - Synthesizes stage contracts with **Role**, **Required Inputs** (including `_config/brand-guidelines.md`), and **Output Contracts**.
     - Registers the pipeline in `boards/launch-plan/CONTEXT.md`.
     - Runs the **Cold-Agent Walk Test** to verify zero broken file references.
     - Projects the compiled stages directly onto your whiteboard canvas with a **`✅ Walk Test Passed`** badge!

---

## Minute 7: Glass-Box ICM File Inspection & Integrations

### 1. Collapsible Right-Hand Panel
- Click the floating **`◂ @scrappy Queue` / `▸ Collapse Panel`** tab on the right edge of the screen to toggle the drawer.
- Collapse it for 100% full-screen canvas space, or expand it to inspect:
  - **`🤖 agy Queue`**: Active prompt contract and status.
  - **`📂 ICM Files`**: Live tree of all markdown files and `_layout.json` on disk.
  - **`📄 Export Doc`**: 1-click Markdown PRD or Mermaid code generation.

### 2. Bi-Directional Filesystem Sync
- Edit any `.md` file inside `boards/launch-plan/sections/<slug>/nodes/` using VS Code, Cursor, or terminal tools.
- Scrappy Whiteboard's `chokidar` file watcher updates the browser canvas live in **<50ms** without reloading!

### 3. Ingesting Webhooks & External Data
- Click **`⚡ Webhook Card`** in the toolbar to simulate an incoming Zapier or GitHub webhook.
- A structured Data Card (`GH-xxx`) lands on the board. Click **`{ } JSON`** on the card to inspect the raw payload.
