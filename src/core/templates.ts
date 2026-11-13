import {
  BoardDocument,
  BoardTemplateKind,
  CanvasEdge,
  CanvasNode,
  SectionNode,
} from './types.js';

/**
 * Creates the default "launch-plan" starter board with Discovery, Architecture, and Launch sections.
 */
export function createDefaultBoard(
  name = 'launch-plan',
  title = 'Product Launch & Architecture Whiteboard'
): BoardDocument {
  const now = new Date().toISOString();

  const secDiscovery: SectionNode = {
    id: 'sec-01-discovery',
    slug: '01_discovery',
    title: '01. Discovery & Goals',
    description: 'Core user problems, target personas, and launch objectives.',
    bounds: { x: 80, y: 100, width: 620, height: 500 },
    color: '#38bdf8',
    icmContextPath: 'sections/01_discovery/CONTEXT.md',
  };

  const secArchitecture: SectionNode = {
    id: 'sec-02-architecture',
    slug: '02_architecture',
    title: '02. Architecture & Flow',
    description: 'End-to-end execution flow from user/agent input to ICM storage and canvas.',
    bounds: { x: 760, y: 100, width: 720, height: 500 },
    color: '#a855f7',
    icmContextPath: 'sections/02_architecture/CONTEXT.md',
  };

  const secLaunch: SectionNode = {
    id: 'sec-03-launch',
    slug: '03_launch_plan',
    title: '03. Launch Checklist & Integrations',
    description: 'Action items, external webhook cards, and open risks.',
    bounds: { x: 1540, y: 100, width: 580, height: 500 },
    color: '#10b981',
    icmContextPath: 'sections/03_launch_plan/CONTEXT.md',
  };

  const nodes: Record<string, CanvasNode> = {
    'node-goal-1': {
      id: 'node-goal-1',
      type: 'sticky',
      sectionId: secDiscovery.id,
      position: { x: 110, y: 170 },
      size: { width: 250, height: 150 },
      content: {
        title: 'Spatial Thinking with AI',
        body: 'Allow humans and Antigravity CLI to brainstorm on a shared 2D canvas before committing to docs.',
        tags: ['vision', 'ux'],
      },
      style: { color: '#fef08a' },
      icmFilePath: 'sections/01_discovery/nodes/node-goal-1.md',
      updatedBy: 'human',
      updatedAt: now,
    },
    'node-goal-2': {
      id: 'node-goal-2',
      type: 'sticky',
      sectionId: secDiscovery.id,
      position: { x: 400, y: 170 },
      size: { width: 260, height: 150 },
      content: {
        title: 'ICM Token Discipline',
        body: 'Scope context by spatial selection or section so agents read 2k-8k tokens instead of the whole board.',
        tags: ['icm', 'tokens'],
      },
      style: { color: '#bbf7d0' },
      icmFilePath: 'sections/01_discovery/nodes/node-goal-2.md',
      updatedBy: 'human',
      updatedAt: now,
    },
    'node-goal-3': {
      id: 'node-goal-3',
      type: 'sticky',
      sectionId: secDiscovery.id,
      position: { x: 240, y: 370 },
      size: { width: 280, height: 155 },
      content: {
        title: 'Bi-Directional ICM-CCTV',
        body: 'Every card maps to `sections/<slug>/nodes/<id>.md` + `_layout.json` for zero merge conflicts.',
        tags: ['icm-cctv', 'storage'],
      },
      style: { color: '#bfdbfe' },
      icmFilePath: 'sections/01_discovery/nodes/node-goal-3.md',
      updatedBy: 'human',
      updatedAt: now,
    },
    'node-flow-1': {
      id: 'node-flow-1',
      type: 'shape',
      sectionId: secArchitecture.id,
      position: { x: 800, y: 180 },
      size: { width: 220, height: 120 },
      content: {
        title: '1. User / Voice Input',
        body: 'Talk, type, or drag-select a region on the React/SVG canvas.',
      },
      style: { color: '#e9d5ff', shape: 'pill' },
      icmFilePath: 'sections/02_architecture/nodes/node-flow-1.md',
      updatedBy: 'human',
      updatedAt: now,
    },
    'node-flow-2': {
      id: 'node-flow-2',
      type: 'shape',
      sectionId: secArchitecture.id,
      position: { x: 1180, y: 180 },
      size: { width: 240, height: 120 },
      content: {
        title: '2. Antigravity CLI Agent',
        body: 'Reads scoped context (`_prompts/ACTIVE_PROMPT.md` or `npm run wb`) & applies batch ops.',
      },
      style: { color: '#c7d2fe', shape: 'rect' },
      icmFilePath: 'sections/02_architecture/nodes/node-flow-2.md',
      updatedBy: 'antigravity-cli',
      updatedAt: now,
    },
    'node-flow-3': {
      id: 'node-flow-3',
      type: 'shape',
      sectionId: secArchitecture.id,
      position: { x: 990, y: 390 },
      size: { width: 250, height: 130 },
      content: {
        title: '3. Export to PRD / Deck',
        body: 'Once structure settles, synthesize board into Markdown doc or Mermaid diagram.',
      },
      style: { color: '#fbcfe8', shape: 'rect' },
      icmFilePath: 'sections/02_architecture/nodes/node-flow-3.md',
      updatedBy: 'human',
      updatedAt: now,
    },
    'node-data-1': {
      id: 'node-data-1',
      type: 'data_card',
      sectionId: secLaunch.id,
      position: { x: 1580, y: 175 },
      size: { width: 280, height: 185 },
      content: {
        title: 'GH-104: Enable WebSocket + Ably Bridge',
        body: 'External integration payload rendered as a live Data Card.',
        structuredData: {
          assignee: '@munron',
          priority: 'P0',
          milestone: 'MVP Phase 1',
          transport: 'ws + ably',
        },
        sourceMeta: {
          provider: 'github-webhook',
          externalId: 'GH-104',
          status: 'in_progress',
          url: 'https://github.com/munronai/icm-cctv',
        },
      },
      style: { color: '#a7f3d0' },
      icmFilePath: 'sections/03_launch_plan/nodes/node-data-1.md',
      updatedBy: 'webhook',
      updatedAt: now,
    },
    'node-suggest-1': {
      id: 'node-suggest-1',
      type: 'suggestion',
      sectionId: secArchitecture.id,
      position: { x: 1190, y: 385 },
      size: { width: 245, height: 135 },
      content: {
        title: 'Gap: Human Review Checkpoint',
        body: 'Suggested by Antigravity: Verify ICM stage output before exporting to final deck.',
        tags: ['ai-gap'],
      },
      style: { color: '#fde68a' },
      suggestionMeta: {
        rationale:
          'Between step 2 (Agent execution) and step 3 (Export), ICM recommends a human-in-the-loop review step.',
        proposedEdges: [
          { fromNodeId: 'node-flow-2', toNodeId: 'node-suggest-1', label: 'proposes' },
          { fromNodeId: 'node-suggest-1', toNodeId: 'node-flow-3', label: 'approves' },
        ],
      },
      icmFilePath: 'sections/02_architecture/nodes/node-suggest-1.md',
      updatedBy: 'antigravity-cli',
      updatedAt: now,
    },
  };

  const edges: Record<string, CanvasEdge> = {
    'edge-1': {
      id: 'edge-1',
      fromNodeId: 'node-goal-1',
      toNodeId: 'node-goal-2',
      label: 'scoped by',
      style: 'solid',
      directed: true,
    },
    'edge-2': {
      id: 'edge-2',
      fromNodeId: 'node-goal-2',
      toNodeId: 'node-goal-3',
      label: 'persisted via',
      style: 'solid',
      directed: true,
    },
    'edge-3': {
      id: 'edge-3',
      fromNodeId: 'node-flow-1',
      toNodeId: 'node-flow-2',
      label: 'dispatches prompt',
      style: 'animated',
      directed: true,
    },
    'edge-4': {
      id: 'edge-4',
      fromNodeId: 'node-flow-2',
      toNodeId: 'node-flow-3',
      label: 'synthesizes',
      style: 'solid',
      directed: true,
    },
  };

  return {
    id: `board-${name}`,
    name,
    title,
    version: 1,
    security: {
      mode: 'public',
    },
    sections: {
      [secDiscovery.id]: secDiscovery,
      [secArchitecture.id]: secArchitecture,
      [secLaunch.id]: secLaunch,
    },
    nodes,
    edges,
    pins: {
      'pin-webhook-inbox': {
        id: 'pin-webhook-inbox',
        label: 'Webhook / Integration Drop Pin',
        position: { x: 1600, y: 410 },
        targetSectionId: secLaunch.id,
      },
    },
    activeSelection: {
      nodeIds: [],
    },
    prompts: [],
    updatedAt: now,
  };
}

/**
 * Creates a completely blank public board.
 */
export function createEmptyBoard(
  name = 'untitled-board',
  title = 'Untitled Whiteboard'
): BoardDocument {
  const now = new Date().toISOString();
  return {
    id: `board-${name}-${Date.now().toString(36)}`,
    name,
    title,
    version: 1,
    security: { mode: 'public' },
    sections: {},
    nodes: {},
    edges: {},
    pins: {},
    activeSelection: { nodeIds: [] },
    prompts: [],
    updatedAt: now,
  };
}

/**
 * Instantiates a board from one of the built-in templates ('default' | 'clean' | 'pipeline' | 'retrospective').
 */
export function createBoardFromTemplate(
  name: string,
  title?: string,
  template: BoardTemplateKind = 'default'
): BoardDocument {
  const finalTitle =
    title || name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (template === 'clean') {
    return createEmptyBoard(name, finalTitle);
  }
  if (template === 'pipeline') {
    const now = new Date().toISOString();
    const sec1: SectionNode = {
      id: 'sec-01-brief',
      slug: '01_brief',
      title: '01. Requirements & Brief',
      description: 'Scope definitions, user criteria, and input contracts.',
      bounds: { x: 80, y: 100, width: 440, height: 480 },
      color: '#38bdf8',
      icmContextPath: 'sections/01_brief/CONTEXT.md',
    };
    const sec2: SectionNode = {
      id: 'sec-02-research',
      slug: '02_research_style',
      title: '02. Research & References',
      description: 'Brand style references, benchmarking, and source context.',
      bounds: { x: 560, y: 100, width: 440, height: 480 },
      color: '#a855f7',
      icmContextPath: 'sections/02_research_style/CONTEXT.md',
    };
    const sec3: SectionNode = {
      id: 'sec-03-generation',
      slug: '03_generation',
      title: '03. Asset Generation',
      description: 'Draft generation, synthesis, and asset creation.',
      bounds: { x: 1040, y: 100, width: 440, height: 480 },
      color: '#10b981',
      icmContextPath: 'sections/03_generation/CONTEXT.md',
    };
    const sec4: SectionNode = {
      id: 'sec-04-qa',
      slug: '04_qa_review',
      title: '04. Review & QA Gate',
      description: 'Verification, Walk Test check, and final handoff.',
      bounds: { x: 1520, y: 100, width: 440, height: 480 },
      color: '#f59e0b',
      icmContextPath: 'sections/04_qa_review/CONTEXT.md',
    };

    const nodes: Record<string, CanvasNode> = {
      'node-brief-1': {
        id: 'node-brief-1',
        type: 'checklist',
        sectionId: sec1.id,
        lockedToSection: true,
        position: { x: 100, y: 170 },
        size: { width: 390, height: 260 },
        content: {
          title: 'Project Requirements',
          body: '- [x] Define target audience\n- [ ] Specify brand style & tone\n- [ ] Set deliverables & milestones',
          checklistItems: [
            { id: 'item-1', text: 'Define target audience', checked: true },
            { id: 'item-2', text: 'Specify brand style & tone', checked: false },
            { id: 'item-3', text: 'Set deliverables & milestones', checked: false },
          ],
        },
        style: { color: '#0f172a' },
        updatedBy: 'human',
        updatedAt: now,
      },
      'node-qa-checklist': {
        id: 'node-qa-checklist',
        type: 'checklist',
        sectionId: sec4.id,
        lockedToSection: true,
        position: { x: 1540, y: 170 },
        size: { width: 390, height: 260 },
        content: {
          title: 'Delivery Gate Checks',
          body: '- [ ] Run ICM Cold-Agent Walk Test\n- [ ] Validate brand consistency\n- [ ] Signoff and export artifacts',
          checklistItems: [
            { id: 'item-qa-1', text: 'Run ICM Cold-Agent Walk Test', checked: false },
            { id: 'item-qa-2', text: 'Validate brand consistency', checked: false },
            { id: 'item-qa-3', text: 'Signoff and export artifacts', checked: false },
          ],
        },
        style: { color: '#0f172a' },
        updatedBy: 'human',
        updatedAt: now,
      },
    };

    const edges: Record<string, CanvasEdge> = {
      'edge-pipe-1': {
        id: 'edge-pipe-1',
        fromNodeId: 'node-brief-1',
        toNodeId: 'node-qa-checklist',
        label: 'pipeline flow',
        style: 'animated',
        directed: true,
      },
    };

    return {
      id: `board-${name}-${Date.now().toString(36)}`,
      name,
      title: finalTitle,
      version: 1,
      security: { mode: 'public' },
      sections: { [sec1.id]: sec1, [sec2.id]: sec2, [sec3.id]: sec3, [sec4.id]: sec4 },
      nodes,
      edges,
      pins: {},
      activeSelection: { nodeIds: [] },
      prompts: [],
      updatedAt: now,
    };
  }
  if (template === 'retrospective') {
    const now = new Date().toISOString();
    const secWentWell: SectionNode = {
      id: 'sec-went-well',
      slug: '01_what_went_well',
      title: '🌟 What Went Well',
      description: 'Wins, successes, and smooth operations.',
      bounds: { x: 100, y: 100, width: 480, height: 500 },
      color: '#10b981',
    };
    const secChallenges: SectionNode = {
      id: 'sec-challenges',
      slug: '02_challenges',
      title: '⚠️ What Needs Improvement',
      description: 'Bottlenecks, bugs, and friction points.',
      bounds: { x: 620, y: 100, width: 480, height: 500 },
      color: '#f43f5e',
    };
    const secActions: SectionNode = {
      id: 'sec-actions',
      slug: '03_actions',
      title: '⚡ Action Items',
      description: 'Decided next steps and bug fixes.',
      bounds: { x: 1140, y: 100, width: 480, height: 500 },
      color: '#38bdf8',
    };

    const nodes: Record<string, CanvasNode> = {
      'node-retro-actions': {
        id: 'node-retro-actions',
        type: 'checklist',
        sectionId: secActions.id,
        lockedToSection: true,
        position: { x: 1160, y: 170 },
        size: { width: 420, height: 260 },
        content: {
          title: 'Sprint Action Items',
          body: '- [ ] Action top retro item with @scrappy\n- [ ] Update team documentation\n- [ ] Automate recurring tests',
          checklistItems: [
            { id: 'act-1', text: 'Action top retro item with @scrappy', checked: false },
            { id: 'act-2', text: 'Update team documentation', checked: false },
            { id: 'act-3', text: 'Automate recurring tests', checked: false },
          ],
        },
        style: { color: '#0f172a' },
        updatedBy: 'human',
        updatedAt: now,
      },
    };

    return {
      id: `board-${name}-${Date.now().toString(36)}`,
      name,
      title: finalTitle,
      version: 1,
      security: { mode: 'public' },
      sections: {
        [secWentWell.id]: secWentWell,
        [secChallenges.id]: secChallenges,
        [secActions.id]: secActions,
      },
      nodes,
      edges: {},
      pins: {},
      activeSelection: { nodeIds: [] },
      prompts: [],
      updatedAt: now,
    };
  }
  return createDefaultBoard(name, finalTitle);
}
