import fs from 'node:fs';
import path from 'node:path';
import {
   applyOperations,
  BoardDocument,
  CanvasNode,
  GraphOp,
  ICMWalkTestResult,
  ICMWorkspaceMeta,
  NodeType,
  RegisteredICMPipeline,
} from '../core/index.js';

export interface CompilePipelineOptions {
  pipelineId?: string;
  title?: string;
  description?: string;
  triggerIntents?: string[];
  sectionId?: string;
  nodeIds?: string[];
  outputWidgetType?: NodeType;
  reflectOnCanvas?: boolean;
}

export interface CompilePipelineResult {
  pipeline: RegisteredICMPipeline;
  walkTest: ICMWalkTestResult;
  createdFiles: string[];
  canvasSectionId?: string;
}

const STARTER_PIPELINES: Array<Omit<RegisteredICMPipeline, 'walkTestPassed'>> = [
  {
    id: 'brand-image-gen',
    title: 'Brand-Aligned Image & Graphic Pipeline',
    description:
      'Generates brand-consistent hero graphics, illustrations, and architectural visuals governed by _config/brand-guidelines.md and _config/visual-style.md.',
    routingPath: 'pipelines/brand-image-gen/CONTEXT.md',
    triggerIntents: [
      'image',
      'graphic',
      'illustration',
      'hero',
      'visual',
      'draw',
      'art',
      'banner',
      'poster',
      'icon',
      'diagram',
    ],
    configRefs: ['_config/brand-guidelines.md', '_config/visual-style.md'],
    stages: ['01-prompt-spec', '02-brand-style-check', '03-render-visual'],
    outputWidgetType: 'svg_graphic',
  },
  {
    id: 'slide-deck-gen',
    title: 'Executive Slide & Narrative Deck Pipeline',
    description:
      'Transforms whiteboard notes into a structured multi-slide narrative arc, slide cards, and an accompanying Mermaid visual summary.',
    routingPath: 'pipelines/slide-deck-gen/CONTEXT.md',
    triggerIntents: ['slide', 'slides', 'deck', 'presentation', 'pitch', 'keynote', 'narrative'],
    configRefs: ['_config/brand-guidelines.md'],
    stages: ['01-narrative-arc', '02-slide-breakdown', '03-visual-mermaid'],
    outputWidgetType: 'sticky',
  },
  {
    id: 'video-content-gen',
    title: 'Video Script & Storyboard Pipeline',
    description:
      'Produces a high-retention video hook, scene-by-scene visual storyboard, and an interactive production checklist.',
    routingPath: 'pipelines/video-content-gen/CONTEXT.md',
    triggerIntents: ['video', 'youtube', 'reel', 'storyboard', 'script', 'shorts', 'demo video'],
    configRefs: ['_config/brand-guidelines.md', '_config/visual-style.md'],
    stages: ['01-hook-and-angle', '02-scene-storyboard', '03-production-checklist'],
    outputWidgetType: 'checklist',
  },
  {
    id: 'bug-triage-fix',
    title: 'ICM Bug Triage & Resolution Pipeline',
    description:
      'Turns bug reports or checklist items into root-cause analysis, fix implementation cards, and a verified QA checklist.',
    routingPath: 'pipelines/bug-triage-fix/CONTEXT.md',
    triggerIntents: ['bug', 'bugs', 'fix', 'triage', 'issue', 'broken', 'qa', 'resolve'],
    configRefs: ['_config/brand-guidelines.md'],
    stages: ['01-reproduce-and-scope', '02-root-cause-plan', '03-verification-checklist'],
    outputWidgetType: 'checklist',
  },
];

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'custom-pipeline'
  );
}

/**
 * Ensures the board workspace has a valid ICM Architect structure:
 * - `_config/brand-guidelines.md` & `_config/visual-style.md`
 * - `pipelines/<id>/CONTEXT.md` + numbered stage folders (`stages/01-.../CONTEXT.md`)
 * - Top-level routing markdown file (`CONTEXT.md`) indexing all pipelines & sections
 */
export function ensureICMArchitectWorkspace(
  boardDir: string,
  board: BoardDocument
): ICMWorkspaceMeta {
  const configDir = path.join(boardDir, '_config');
  const pipelinesDir = path.join(boardDir, 'pipelines');
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(pipelinesDir, { recursive: true });

  const brandGuidelinesPath = path.join(configDir, 'brand-guidelines.md');
  if (!fs.existsSync(brandGuidelinesPath)) {
    fs.writeFileSync(
      brandGuidelinesPath,
      [
        '# Brand & Communication Guidelines (`_config/brand-guidelines.md`)',
        '',
        '## Core Identity',
        '- **Product:** Scrappy Whiteboard (ICM Spatial Control Plane & Architect Studio)',
        '- **Tone:** Clear, technical, concise, zero-fluff, glass-box interpretable.',
        '- **Key Principles:**',
        '  1. Token Discipline (2k–8k tokens per stage)',
        '  2. Filesystem-as-Architecture (plain Markdown + `_layout.json` sidecar)',
        '  3. Cold-Agent Walkability (every stage declares Role, Inputs, Process, Outputs)',
        '',
      ].join('\n'),
      'utf8'
    );
  }

  const visualStylePath = path.join(configDir, 'visual-style.md');
  if (!fs.existsSync(visualStylePath)) {
    fs.writeFileSync(
      visualStylePath,
      [
        '# Visual & Graphic Style System (`_config/visual-style.md`)',
        '',
        '## Color Palette',
        '- **Primary Indigo:** `#4f46e5` / `#6366f1`',
        '- **Accent Sky / Cyan:** `#0ea5e9` / `#38bdf8`',
        '- **Success Emerald:** `#10b981` / `#34d399`',
        '- **Warm Amber Highlight:** `#f59e0b` / `#fbbf24`',
        '- **Dark Canvas Surface:** `#0f172a` to `#1e1b4b`',
        '',
        '## Graphic & Illustration Rules',
        '- Use crisp multi-layered vector compositions, glowing node badges, and clear directional hierarchy.',
        '- Prefer readable typography (`Inter, system-ui`) and high-contrast labels.',
        '',
      ].join('\n'),
      'utf8'
    );
  }

  // Scaffold starter pipelines if not yet present on disk
  for (const starter of STARTER_PIPELINES) {
    scaffoldPipelineOnDisk(boardDir, starter);
  }

  // Discover all pipelines in `pipelines/*`
  const discovered = discoverICMPipelines(boardDir);

  // Write / refresh top-level routing file `CONTEXT.md`
  writeTopLevelRoutingFile(boardDir, board, discovered);

  // Run Walk Test
  const walkTest = runICMWalkTest(boardDir, discovered);
  for (const p of discovered) {
    p.walkTestPassed = walkTest.passed;
  }

  const meta: ICMWorkspaceMeta = {
    rootRoutingFile: `boards/${board.name}/CONTEXT.md`,
    form: discovered.length > 1 ? 'umbrella' : 'pipeline',
    configFiles: ['_config/brand-guidelines.md', '_config/visual-style.md'],
    pipelines: discovered,
    lastWalkTest: walkTest,
  };

  board.icmWorkspace = meta;
  return meta;
}

function scaffoldPipelineOnDisk(
  boardDir: string,
  spec: Omit<RegisteredICMPipeline, 'walkTestPassed'>,
  stageDescriptions?: Array<{ slug: string; title: string; body: string }>
): string[] {
  const createdFiles: string[] = [];
  const pipeDir = path.join(boardDir, 'pipelines', spec.id);
  const stagesDir = path.join(pipeDir, 'stages');
  fs.mkdirSync(stagesDir, { recursive: true });

  const pipelineContextPath = path.join(pipeDir, 'CONTEXT.md');
  if (!fs.existsSync(pipelineContextPath) || stageDescriptions) {
    const content = [
      '---',
      `id: ${spec.id}`,
      `title: ${JSON.stringify(spec.title)}`,
      `description: ${JSON.stringify(spec.description)}`,
      `triggers: ${JSON.stringify(spec.triggerIntents)}`,
      `configs: ${JSON.stringify(spec.configRefs)}`,
      `stages: ${JSON.stringify(spec.stages)}`,
      `outputWidgetType: ${spec.outputWidgetType}`,
      '---',
      `# ICM Pipeline: ${spec.title}`,
      '',
      `> ${spec.description}`,
      '',
      '## Shared Configuration Inputs (`_config/`)',
      ...spec.configRefs.map((c) => `- [\`${c}\`](../../${c})`),
      '',
      '## Stage Sequence (Execution Order)',
      ...spec.stages.map(
        (stageSlug, idx) =>
          `${idx + 1}. [\`stages/${stageSlug}/CONTEXT.md\`](./stages/${stageSlug}/CONTEXT.md)`
      ),
      '',
      '## Cold-Agent Walk Contract',
      '1. Read the shared `_config/` files listed above.',
      '2. Execute each stage in `stages/01-...` through `stages/0N-...` sequentially.',
      '3. Write each stage artifact to `stages/<stage>/output/result.md` and project the final deliverable onto the whiteboard scope.',
      '',
    ].join('\n');
    fs.writeFileSync(pipelineContextPath, content, 'utf8');
    createdFiles.push(pipelineContextPath);
  }

  spec.stages.forEach((stageSlug, idx) => {
    const stageFolder = path.join(stagesDir, stageSlug);
    const outputFolder = path.join(stageFolder, 'output');
    fs.mkdirSync(outputFolder, { recursive: true });

    const stageContextPath = path.join(stageFolder, 'CONTEXT.md');
    const customStage = stageDescriptions?.[idx];
    const prevStage = idx > 0 ? spec.stages[idx - 1] : null;
    const nextStage = idx < spec.stages.length - 1 ? spec.stages[idx + 1] : null;

    if (!fs.existsSync(stageContextPath) || customStage) {
      const stageTitle =
        customStage?.title ||
        stageSlug
          .replace(/^\d+-/, '')
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

      const stageMd = [
        '---',
        `stage: ${idx + 1}`,
        `slug: ${stageSlug}`,
        `pipeline: ${spec.id}`,
        '---',
        `# Stage ${idx + 1}: ${stageTitle}`,
        '',
        '## 1. Role & Objective',
        customStage?.body
          ? customStage.body
          : `Execute stage **${stageTitle}** for pipeline **${spec.title}**.`,
        '',
        '## 2. Required Inputs',
        ...spec.configRefs.map((c) => `- Shared Config: \`../../../../${c}\``),
        prevStage
          ? `- Previous Stage Output: \`../${prevStage}/output/result.md\``
          : '- User `@scrappy` prompt & scoped whiteboard context (`_prompts/ACTIVE_PROMPT.md`)',
        '',
        '## 3. Process & Instructions',
        '- Maintain ICM token discipline (read only the inputs listed above).',
        '- Apply brand & visual rules from `_config/` where applicable.',
        `- Produce a structured artifact ready for ${nextStage ? `Stage ${idx + 2} (\`${nextStage}\`)` : `final whiteboard rendering (\`${spec.outputWidgetType}\`)`}.`,
        '',
        '## 4. Output Contract & Gate Check',
        `- **Output File:** \`./output/result.md\``,
        `- **Next Handoff:** ${nextStage ? `\`../${nextStage}/CONTEXT.md\`` : 'Project final deliverable card onto the active Whiteboard Scope Section.'}`,
        '',
      ].join('\n');

      fs.writeFileSync(stageContextPath, stageMd, 'utf8');
      createdFiles.push(stageContextPath);
    }
  });

  return createdFiles;
}

/**
 * Discovers all ICM pipelines inside `boards/<board-name>/pipelines/*`
 */
export function discoverICMPipelines(boardDir: string): RegisteredICMPipeline[] {
  const pipelinesDir = path.join(boardDir, 'pipelines');
  if (!fs.existsSync(pipelinesDir)) return [];

  const entries = fs.readdirSync(pipelinesDir, { withFileTypes: true });
  const results: RegisteredICMPipeline[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pipeId = entry.name;
    const contextPath = path.join(pipelinesDir, pipeId, 'CONTEXT.md');
    const stagesDir = path.join(pipelinesDir, pipeId, 'stages');

    let title = pipeId;
    let description = `ICM Pipeline (${pipeId})`;
    let triggerIntents: string[] = [pipeId];
    let configRefs: string[] = ['_config/brand-guidelines.md'];
    let stages: string[] = [];
    let outputWidgetType: NodeType = 'sticky';

    if (fs.existsSync(stagesDir)) {
      stages = fs
        .readdirSync(stagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
    }

    if (fs.existsSync(contextPath)) {
      const raw = fs.readFileSync(contextPath, 'utf8');
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fm = fmMatch[1];
        for (const line of fm.split('\n')) {
          const idx = line.indexOf(':');
          if (idx === -1) continue;
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          try {
            if (k === 'title') title = JSON.parse(v);
            else if (k === 'description') description = JSON.parse(v);
            else if (k === 'triggers') triggerIntents = JSON.parse(v);
            else if (k === 'configs') configRefs = JSON.parse(v);
            else if (k === 'stages' && stages.length === 0) stages = JSON.parse(v);
            else if (k === 'outputWidgetType') outputWidgetType = v as NodeType;
          } catch {
            if (k === 'title') title = v;
          }
        }
      }
    }

    results.push({
      id: pipeId,
      title,
      description,
      routingPath: `pipelines/${pipeId}/CONTEXT.md`,
      triggerIntents,
      configRefs,
      stages,
      outputWidgetType,
      walkTestPassed: true,
    });
  }

  return results;
}

/**
 * Writes the top-level ICM routing markdown file (`boards/<name>/CONTEXT.md`)
 * following `RinDig/icm-architect` umbrella/router conventions.
 */
export function writeTopLevelRoutingFile(
  boardDir: string,
  board: BoardDocument,
  pipelines: RegisteredICMPipeline[]
): void {
  const rootContextPath = path.join(boardDir, 'CONTEXT.md');
  const sections = Object.values(board.sections);

  const lines: string[] = [
    `# ${board.title} — Top-Level ICM Routing Map (\`CONTEXT.md\`)`,
    '',
    '> **ICM Architect Workspace Router (`RinDig/icm-architect` Compatible)**',
    '> A cold agent with zero prior memory can start at this file, identify the right pipeline or spatial section, load only the scoped `_config/` and stage `CONTEXT.md` files (maintaining 2k–8k token discipline), and execute the task.',
    '',
    '## 1. Global Shared Context (`_config/`)',
    '- [`_config/brand-guidelines.md`](./_config/brand-guidelines.md) — Core brand voice, principles, and output quality gates.',
    '- [`_config/visual-style.md`](./_config/visual-style.md) — Color palette, typography, and SVG/graphic styling rules.',
    '',
    '## 2. Registered ICM Pipelines (`@scrappy` Routing Table)',
    'When `@scrappy` is invoked on the whiteboard, match the user request against these specialized ICM pipelines before falling back to ad-hoc agent execution:',
    '',
    '| Pipeline ID | Pipeline Name | Trigger Intents | Stages | Shared `_config/` | Entry Point |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
    ...pipelines.map(
      (p) =>
        `| \`${p.id}\` | **${p.title}** | ${p.triggerIntents.slice(0, 6).map((t) => `\`${t}\``).join(', ')} | ${p.stages.length} stages (\`${p.stages[0] || ''}\` → \`${p.stages[p.stages.length - 1] || ''}\`) | ${p.configRefs.map((c) => `\`${c}\``).join(', ')} | [\`${p.routingPath}\`](./${p.routingPath}) |`
    ),
    '',
    '## 3. Active Whiteboard Scope Sections (`sections/`)',
    '| Section Slug | Title | Nodes | Context Contract |',
    '| :--- | :--- | :--- | :--- |',
    ...sections.map((sec) => {
      const count = Object.values(board.nodes).filter((n) => n.sectionId === sec.id).length;
      return `| \`${sec.slug}\` | **${sec.title}** | ${count} cards | [\`sections/${sec.slug}/CONTEXT.md\`](./sections/${sec.slug}/CONTEXT.md) |`;
    }),
    '',
    '## 4. Spatial Geometry & Prompt Queue Sidecars',
    '- **Spatial Layout Sidecar:** [`_layout.json`](./_layout.json) (stores 2D canvas coordinates, sizes, colors, and connector styles without polluting Markdown files).',
    '- **Active `@scrappy` Prompt Queue:** [`_prompts/ACTIVE_PROMPT.md`](./_prompts/ACTIVE_PROMPT.md).',
    '',
  ];

  fs.writeFileSync(rootContextPath, lines.join('\n'), 'utf8');
}

/**
 * Implements `RinDig/icm-architect`'s Cold-Agent "Walk Test":
 * Verifies that starting from `CONTEXT.md`, every registered pipeline,
 * `_config/` file, and numbered stage folder (`stages/01-.../CONTEXT.md`)
 * exists on disk and contains valid Role/Inputs/Output instructions.
 */
export function runICMWalkTest(
  boardDir: string,
  pipelines?: RegisteredICMPipeline[]
): ICMWalkTestResult {
  const targetPipelines = pipelines || discoverICMPipelines(boardDir);
  const brokenReferences: string[] = [];
  let stagesChecked = 0;

  const rootRoutingPath = path.join(boardDir, 'CONTEXT.md');
  if (!fs.existsSync(rootRoutingPath)) {
    brokenReferences.push('CONTEXT.md (missing root routing file)');
  }

  for (const pipe of targetPipelines) {
    const pipeContext = path.join(boardDir, pipe.routingPath);
    if (!fs.existsSync(pipeContext)) {
      brokenReferences.push(`${pipe.routingPath} (missing pipeline CONTEXT.md)`);
    }

    for (const cfg of pipe.configRefs) {
      const cfgPath = path.join(boardDir, cfg);
      if (!fs.existsSync(cfgPath)) {
        brokenReferences.push(`${cfg} (referenced by ${pipe.id})`);
      }
    }

    for (const stageSlug of pipe.stages) {
      stagesChecked += 1;
      const stageContext = path.join(
        boardDir,
        'pipelines',
        pipe.id,
        'stages',
        stageSlug,
        'CONTEXT.md'
      );
      if (!fs.existsSync(stageContext)) {
        brokenReferences.push(`pipelines/${pipe.id}/stages/${stageSlug}/CONTEXT.md`);
      } else {
        const text = fs.readFileSync(stageContext, 'utf8');
        if (!text.includes('Required Inputs') || !text.includes('Output Contract')) {
          brokenReferences.push(
            `pipelines/${pipe.id}/stages/${stageSlug}/CONTEXT.md (incomplete contract sections)`
          );
        }
      }
    }
  }

  const passed = brokenReferences.length === 0;
  return {
    passed,
    checkedAt: new Date().toISOString(),
    rootRoutingFile: 'CONTEXT.md',
    form: targetPipelines.length > 1 ? 'umbrella' : 'pipeline',
    stagesChecked,
    brokenReferences,
    summary: passed
      ? `✅ Walk Test Passed: ${targetPipelines.length} ICM pipelines (${stagesChecked} stages) verified walkable from CONTEXT.md with 0 broken references.`
      : `⚠️ Walk Test found ${brokenReferences.length} issue(s) across ${stagesChecked} stages.`,
  };
}

/**
 * Matches a `@scrappy` prompt against registered ICM pipelines in the top-level routing file.
 */
export function matchPipelinesForPrompt(
  promptText: string,
  pipelines: RegisteredICMPipeline[]
): RegisteredICMPipeline[] {
  const clean = promptText.toLowerCase().replace(/^@scrappy\b[:\s,-]*/i, '').trim();
  if (!clean) return [];

  const scored: Array<{ pipeline: RegisteredICMPipeline; score: number }> = [];
  for (const pipe of pipelines) {
    let score = 0;
    if (clean.includes(pipe.id.toLowerCase())) score += 5;
    for (const trigger of pipe.triggerIntents) {
      const t = trigger.toLowerCase();
      if (clean.includes(t)) {
        score += t.length >= 5 ? 3 : 2;
      }
    }
    if (score > 0) {
      scored.push({ pipeline: pipe, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.pipeline);
}

/**
 * Explicit Action: Compiles a Whiteboard Brainstorm (Scope Section, selected nodes, or board)
 * into a structured, Walk-Test-verified ICM Pipeline using `RinDig/icm-architect` principles.
 */
export function compileCanvasToICMPipeline(
  boardDir: string,
  board: BoardDocument,
  options: CompilePipelineOptions
): CompilePipelineResult {
  // 1. Gather source nodes from selection, section, or board
  let sourceNodes: CanvasNode[] = [];
  const targetSection = options.sectionId ? board.sections[options.sectionId] : undefined;

  if (options.nodeIds && options.nodeIds.length > 0) {
    sourceNodes = options.nodeIds.map((id) => board.nodes[id]).filter(Boolean);
  } else if (options.sectionId) {
    sourceNodes = Object.values(board.nodes).filter((n) => n.sectionId === options.sectionId);
  } else if (board.activeSelection.nodeIds.length > 0) {
    sourceNodes = board.activeSelection.nodeIds.map((id) => board.nodes[id]).filter(Boolean);
  } else if (board.activeSelection.sectionId) {
    sourceNodes = Object.values(board.nodes).filter(
      (n) => n.sectionId === board.activeSelection.sectionId
    );
  } else {
    sourceNodes = Object.values(board.nodes).slice(0, 6);
  }

  // Sort nodes in logical flow order (left-to-right, then top-to-bottom)
  sourceNodes.sort((a, b) => {
    if (Math.abs(a.position.x - b.position.x) > 80) {
      return a.position.x - b.position.x;
    }
    return a.position.y - b.position.y;
  });

  const baseTitle =
    options.title?.trim() ||
    (targetSection ? `${targetSection.title.replace(/^\d+\s*[·.-]\s*/, '')} Pipeline` : 'Custom Canvas ICM Pipeline');
  const pipelineId = slugify(options.pipelineId || baseTitle);

  const stageDescriptions =
    sourceNodes.length > 0
      ? sourceNodes.slice(0, 6).map((node, idx) => {
          const rawTitle = node.content.title || `Stage ${idx + 1}`;
          const numPrefix = String(idx + 1).padStart(2, '0');
          const stageSlug = `${numPrefix}-${slugify(rawTitle).slice(0, 24)}`;
          return {
            slug: stageSlug,
            title: rawTitle,
            body: node.content.body || `Execute ${rawTitle} stage.`,
          };
        })
      : [
          { slug: '01-scope-and-context', title: 'Scope & Context', body: 'Define scope and inputs.' },
          { slug: '02-synthesis-and-draft', title: 'Synthesis & Draft', body: 'Synthesize core deliverable.' },
          { slug: '03-review-and-publish', title: 'Review & Publish', body: 'Verify against _config/ gates.' },
        ];

  const inferredTriggers =
    options.triggerIntents && options.triggerIntents.length > 0
      ? options.triggerIntents
      : Array.from(
          new Set(
            baseTitle
              .toLowerCase()
              .split(/[^a-z0-9]+/)
              .filter((w) => w.length >= 3 && w !== 'pipeline' && w !== 'icm' && w !== 'the')
          )
        );

  if (inferredTriggers.length === 0) {
    inferredTriggers.push(pipelineId);
  }

  const spec: Omit<RegisteredICMPipeline, 'walkTestPassed'> = {
    id: pipelineId,
    title: baseTitle,
    description:
      options.description?.trim() ||
      `Compiled via icm-architect from ${sourceNodes.length} whiteboard card(s)${targetSection ? ` in "${targetSection.title}"` : ''}.`,
    routingPath: `pipelines/${pipelineId}/CONTEXT.md`,
    triggerIntents: inferredTriggers,
    configRefs: ['_config/brand-guidelines.md', '_config/visual-style.md'],
    stages: stageDescriptions.map((s) => s.slug),
    outputWidgetType: options.outputWidgetType || 'sticky',
  };

  // 2. Scaffold the ICM pipeline folder structure & stage CONTEXT.md files
  const createdFiles = scaffoldPipelineOnDisk(boardDir, spec, stageDescriptions);

  // 3. Re-index pipelines, update top-level routing CONTEXT.md, and run Walk Test
  const allPipelines = discoverICMPipelines(boardDir);
  writeTopLevelRoutingFile(boardDir, board, allPipelines);
  const walkTest = runICMWalkTest(boardDir, allPipelines);

  const compiledPipeline: RegisteredICMPipeline = {
    ...spec,
    walkTestPassed: walkTest.passed,
  };

  // 4. Optionally reflect the compiled ICM Pipeline on the Whiteboard Canvas!
  let canvasSectionId = targetSection?.id;
  if (options.reflectOnCanvas !== false) {
    const ops: GraphOp[] = [];
    const existingSecs = Object.values(board.sections);
    const maxY = existingSecs.reduce(
      (acc, s) => Math.max(acc, s.bounds.y + s.bounds.height),
      60
    );
    const secId = `sec-icm-${pipelineId}`;
    const secX = targetSection ? targetSection.bounds.x : 60;
    const secY = targetSection ? targetSection.bounds.y + targetSection.bounds.height + 50 : maxY + 50;
    const secW = Math.max(620, stageDescriptions.length * 255 + 60);
    const secH = 260;

    if (!board.sections[secId]) {
      ops.push({
        op: 'create_section',
        section: {
          id: secId,
          slug: `icm_${pipelineId.replace(/-/g, '_')}`,
          title: `🏗️ ICM Pipeline: ${baseTitle} (${walkTest.passed ? '✅ Walk Test Passed' : '⚠️ Check Refs'})`,
          description: `Routing: pipelines/${pipelineId}/CONTEXT.md | Triggers: ${inferredTriggers.join(', ')}`,
          bounds: { x: secX, y: secY, width: secW, height: secH },
          color: '#dcfce7',
        },
      });
    }

    let prevStageNodeId: string | undefined;
    stageDescriptions.forEach((st, idx) => {
      const stageNodeId = `node-pipe-${pipelineId}-${idx + 1}`;
      ops.push({
        op: 'create_node',
        node: {
          id: stageNodeId,
          type: 'shape',
          sectionId: secId,
          lockedToSection: true,
          position: {
            x: secX + 28 + idx * 245,
            y: secY + 68,
          },
          size: { width: 225, height: 155 },
          content: {
            title: `${st.slug}`,
            body: `**${st.title}**\n\n${st.body.slice(0, 110)}\n\n📄 \`pipelines/${pipelineId}/stages/${st.slug}/CONTEXT.md\``,
            tags: ['icm-stage', pipelineId],
          },
          style: {
            color: idx === stageDescriptions.length - 1 ? '#bbf7d0' : '#e0e7ff',
            shape: 'rect',
          },
        },
      });

      if (prevStageNodeId) {
        ops.push({
          op: 'create_edge',
          edge: {
            fromNodeId: prevStageNodeId,
            toNodeId: stageNodeId,
            label: `stage ${idx} → ${idx + 1}`,
            style: 'solid',
            directed: true,
          },
        });
      }
      prevStageNodeId = stageNodeId;
    });

    applyOperations(board, ops, 'icm-architect');
    canvasSectionId = secId;
  }

  board.icmWorkspace = {
    rootRoutingFile: `boards/${board.name}/CONTEXT.md`,
    form: allPipelines.length > 1 ? 'umbrella' : 'pipeline',
    configFiles: ['_config/brand-guidelines.md', '_config/visual-style.md'],
    pipelines: allPipelines,
    lastWalkTest: walkTest,
  };

  return {
    pipeline: compiledPipeline,
    walkTest,
    createdFiles,
    canvasSectionId,
  };
}
