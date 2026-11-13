import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyOperations,
  createBoardFromTemplate,
  createDefaultBoard,
  createEmptyBoard,
  extractSpatialSlice,
  extractTableFromMarkdown,
  formatTableToMarkdown,
  resolveTableStyles,
  synthesizeBoardToMarkdown,
} from './engine.js';
import { ICMAdapter } from '../icm/adapter.js';
import {
  compileCanvasToICMPipeline,
  matchPipelinesForPrompt,
  runICMWalkTest,
} from '../icm/architect.js';
import { executeInstantAgentAction } from '../server/smartAgent.js';

describe('Scrappy Whiteboard MVP Core & ICM Option A Adapter', () => {
  it('creates default board and scopes context by selection or section', () => {
    const board = createDefaultBoard('test-board', 'Test Whiteboard');
    expect(Object.keys(board.sections).length).toBe(3);
    expect(Object.keys(board.nodes).length).toBeGreaterThanOrEqual(7);

    // Scope by single section
    const discoverySlice = extractSpatialSlice(board, {
      sectionId: 'sec-01-discovery',
      includeConnected: false,
    });
    expect(discoverySlice.nodes.length).toBe(3);
    expect(discoverySlice.tokenEstimate).toBeLessThan(2000);
  });

  it('applies batch operations and accepts AI gap suggestions', () => {
    const board = createDefaultBoard('ops-board');
    applyOperations(board, [
      {
        op: 'accept_suggestion',
        id: 'node-suggest-1',
      },
    ]);
    expect(board.nodes['node-suggest-1'].type).toBe('sticky');
    expect(Object.keys(board.edges).length).toBeGreaterThan(4);
  });

  it('moves and proportionally resizes locked child cards when a scope section is moved or resized', () => {
    const board = createDefaultBoard('resize-board');
    const origSec = { ...board.sections['sec-01-discovery'].bounds };
    const origNodePos = { ...board.nodes['node-goal-1'].position };
    const origNodeSize = { ...board.nodes['node-goal-1'].size };

    // 1. Move section by (+100, +50)
    applyOperations(board, [
      {
        op: 'update_section',
        id: 'sec-01-discovery',
        patch: {
          bounds: {
            x: origSec.x + 100,
            y: origSec.y + 50,
            width: origSec.width,
            height: origSec.height,
          },
        },
      },
    ]);
    expect(board.nodes['node-goal-1'].position.x).toBe(origNodePos.x + 100);
    expect(board.nodes['node-goal-1'].position.y).toBe(origNodePos.y + 50);

    // 2. Resize section to 2x width & 2x height
    applyOperations(board, [
      {
        op: 'update_section',
        id: 'sec-01-discovery',
        patch: {
          bounds: {
            x: origSec.x + 100,
            y: origSec.y + 50,
            width: origSec.width * 2,
            height: origSec.height * 2,
          },
        },
      },
    ]);
    expect(board.nodes['node-goal-1'].size.width).toBe(origNodeSize.width * 2);
    expect(board.nodes['node-goal-1'].size.height).toBe(origNodeSize.height * 2);
  });

  it('persists and reloads Option A node-per-file markdown + _layout.json accurately', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-icm-'));
    const icm = new ICMAdapter(tmpDir);
    const board = icm.ensureBoardLoaded('launch-plan', 'Launch Board');

    const nodeMdPath = path.join(
      tmpDir,
      'launch-plan',
      'sections',
      '01_discovery',
      'nodes',
      'node-goal-1.md'
    );
    expect(fs.existsSync(nodeMdPath)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'launch-plan', '_layout.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'launch-plan', 'BOARD_MAP.md'))).toBe(true);

    const reloaded = icm.loadBoardFromDisk('launch-plan');
    expect(reloaded.nodes['node-goal-1'].content.title).toBe(
      board.nodes['node-goal-1'].content.title
    );

    const mdDoc = synthesizeBoardToMarkdown(reloaded);
    expect(mdDoc).toContain('# Launch Board');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists interactive checklist and mermaid widgets across ICMAdapter restarts and auto-upgrades markdown task lists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-widgets-'));
    const icm = new ICMAdapter(tmpDir);
    const board = icm.ensureBoardLoaded('widget-board', 'Widget Persistence Board');

    applyOperations(board, [
      {
        op: 'create_node',
        node: {
          id: 'node-chk-1',
          type: 'checklist',
          sectionId: 'sec-01-discovery',
          position: { x: 120, y: 180 },
          content: {
            title: 'Bug Triage List',
            body: '',
            checklistItems: [
              { id: 'bug-1', text: 'Fix scope resize corner handles', checked: true },
              { id: 'bug-2', text: 'Persist checklist items across restart', checked: false },
            ],
          },
        },
      },
      {
        op: 'create_node',
        node: {
          id: 'node-mmd-1',
          type: 'mermaid',
          sectionId: 'sec-02-architecture',
          position: { x: 540, y: 180 },
          content: {
            title: 'System Flow',
            body: '',
            mermaidCode: 'flowchart LR\n  A[Canvas] --> B[ICM Option A]',
          },
        },
      },
    ]);

    icm.saveBoardToDisk(board);

    const reloaded = icm.loadBoardFromDisk('widget-board');
    expect(reloaded.nodes['node-chk-1'].type).toBe('checklist');
    expect(reloaded.nodes['node-chk-1'].content.checklistItems?.length).toBe(2);
    expect(reloaded.nodes['node-chk-1'].content.checklistItems?.[0].checked).toBe(true);
    expect(reloaded.nodes['node-chk-1'].content.checklistItems?.[1].text).toBe(
      'Persist checklist items across restart'
    );

    expect(reloaded.nodes['node-mmd-1'].type).toBe('mermaid');
    expect(reloaded.nodes['node-mmd-1'].content.mermaidCode).toContain('flowchart LR');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates connector edge style (solid, dashed, animated) and label via update_edge', () => {
    const board = createDefaultBoard('edge-board');
    const firstEdgeId = Object.keys(board.edges)[0];
    expect(firstEdgeId).toBeDefined();

    applyOperations(board, [
      {
        op: 'update_edge',
        id: firstEdgeId,
        patch: {
          style: 'solid',
          label: 'persistent link',
        },
      },
    ]);

    expect(board.edges[firstEdgeId].style).toBe('solid');
    expect(board.edges[firstEdgeId].label).toBe('persistent link');
  });

  it('respects Focus Region and Scope Section bounds during /update-scrappy execution', () => {
    const board = createDefaultBoard('scope-prompt-board');
    const focusBounds = { x: 520, y: 120, width: 360, height: 320 };

    const res = executeInstantAgentAction(board, {
      id: 'prm-scope-1',
      createdAt: new Date().toISOString(),
      prompt: '@scrappy create a mermaid diagram of the architecture flow',
      selectedNodeIds: [],
      selectedSectionId: 'sec-02-architecture',
      boundingBox: focusBounds,
      anchorPosition: { x: 560, y: 180 },
      status: 'pending',
    });

    expect(res.opsCount).toBeGreaterThan(0);
    const createdMermaid = Object.values(board.nodes).find(
      (n) => n.type === 'mermaid' && n.sectionId === 'sec-02-architecture'
    );
    expect(createdMermaid).toBeDefined();
    expect(createdMermaid!.position.x).toBeGreaterThanOrEqual(focusBounds.x);
    expect(createdMermaid!.position.y).toBeGreaterThanOrEqual(focusBounds.y);
  });

  it('scaffolds top-level ICM routing CONTEXT.md, matches pipelines for @scrappy, and compiles brainstorms via icm-architect with Walk Test', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-architect-'));
    const icm = new ICMAdapter(tmpDir);
    const board = icm.ensureBoardLoaded('architect-board', 'ICM Architect Test Board');
    const boardDir = icm.getBoardDir('architect-board');

    // 1. Verify top-level routing file CONTEXT.md and starter pipelines exist and pass Walk Test
    expect(fs.existsSync(path.join(boardDir, 'CONTEXT.md'))).toBe(true);
    expect(fs.existsSync(path.join(boardDir, '_config', 'brand-guidelines.md'))).toBe(true);
    expect(board.icmWorkspace?.pipelines.length).toBeGreaterThanOrEqual(4);
    expect(board.icmWorkspace?.lastWalkTest?.passed).toBe(true);

    // 2. Verify @scrappy prompt pipeline detection from top-level routing table
    const imageMatched = matchPipelinesForPrompt(
      '@scrappy generate a hero image for our product launch',
      board.icmWorkspace!.pipelines
    );
    expect(imageMatched.length).toBeGreaterThan(0);
    expect(imageMatched[0].id).toBe('brand-image-gen');

    const videoMatched = matchPipelinesForPrompt(
      '@scrappy write a youtube video script and storyboard',
      board.icmWorkspace!.pipelines
    );
    expect(videoMatched[0].id).toBe('video-content-gen');

    // 3. Explicitly compile Scope Section 01 into a new ICM Pipeline via icm-architect
    const compiled = compileCanvasToICMPipeline(boardDir, board, {
      title: 'Discovery Synthesis Pipeline',
      sectionId: 'sec-01-discovery',
      triggerIntents: ['discovery', 'customer', 'synthesis'],
      reflectOnCanvas: true,
    });

    expect(compiled.pipeline.id).toBe('discovery-synthesis-pipeline');
    expect(compiled.pipeline.stages.length).toBe(3);
    expect(compiled.walkTest.passed).toBe(true);
    expect(
      fs.existsSync(path.join(boardDir, 'pipelines', 'discovery-synthesis-pipeline', 'CONTEXT.md'))
    ).toBe(true);

    const rootContextMd = fs.readFileSync(path.join(boardDir, 'CONTEXT.md'), 'utf8');
    expect(rootContextMd).toContain('discovery-synthesis-pipeline');

    const finalWalk = runICMWalkTest(boardDir);
    expect(finalWalk.passed).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses, formats, and translates natural language styles for Interactive Table component', () => {
    // 1. Format table data to Markdown table
    const tableData = {
      columns: ['Architecture', 'Pros', 'Cons', 'Verdict'],
      rows: [
        ['Option A', 'Clean git diffs', 'Sync layer needed', 'Recommended'],
        ['Option B', 'Single file', 'Merge nightmare', 'Avoid'],
      ],
      stylePreset: 'sky' as const,
      customStyleDescription: 'sky blue header with zebra stripes and rounded borders',
    };

    const md = formatTableToMarkdown(tableData);
    expect(md).toContain('| Architecture | Pros | Cons | Verdict |');
    expect(md).toContain('| :--- | :--- | :--- | :--- |');
    expect(md).toContain('| Option A | Clean git diffs | Sync layer needed | Recommended |');

    // 2. Extract table data from raw Markdown
    const parsed = extractTableFromMarkdown(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.columns).toEqual(['Architecture', 'Pros', 'Cons', 'Verdict']);
    expect(parsed!.rows.length).toBe(2);
    expect(parsed!.rows[0][0]).toBe('Option A');
    expect(parsed!.rows[1][3]).toBe('Avoid');

    // 3. Resolve Natural Language Style Description to CSS & Design Tokens without knowing CSS
    const resolvedSky = resolveTableStyles({
      stylePreset: 'sky',
      customStyleDescription: 'zebra striped with sky blue header, compact font and rounded borders',
    });
    expect(resolvedSky.headerBg).toBe('#0284c7');
    expect(resolvedSky.headerColor).toBe('#ffffff');
    expect(resolvedSky.zebra).toBe(true);
    expect(resolvedSky.fontSize).toBe('11.5px');
    expect(resolvedSky.borderRadius).toBe(8);
    expect(resolvedSky.cssCode).toContain('.scrappy-table');
    expect(resolvedSky.cssCode).toContain('background-color: #0284c7');

    const resolvedEmerald = resolveTableStyles({
      stylePreset: 'emerald',
      customStyleDescription: 'spacious minimal emerald theme',
    });
    expect(resolvedEmerald.headerBg).toBe('#059669');
    expect(resolvedEmerald.padding).toBe('10px 14px');
  });

  it('persists interactive Table nodes in ICM Option A format and supports @scrappy comparison matrix generation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-table-'));
    const icm = new ICMAdapter(tmpDir);
    const board = icm.ensureBoardLoaded('table-board', 'Table Persistence Test Board');

    // 1. Generate table via @scrappy prompt
    const scrappyRes = executeInstantAgentAction(board, {
      id: 'req-table-1',
      createdAt: new Date().toISOString(),
      prompt: '@scrappy create a comparison table with pros and cons',
      selectedSectionId: 'sec-02-architecture',
      selectedNodeIds: [],
      anchorPosition: { x: 500, y: 220 },
      status: 'pending',
    });

    expect(scrappyRes.opsCount).toBeGreaterThan(0);
    const tableNode = Object.values(board.nodes).find((n) => n.type === 'table');
    expect(tableNode).toBeDefined();
    expect(tableNode!.content.tableData).toBeDefined();
    expect(tableNode!.content.tableData!.columns.length).toBeGreaterThanOrEqual(3);
    expect(tableNode!.content.body).toContain('|');

    // 2. Save board to disk (ICM Option A node-per-file)
    icm.saveBoardToDisk(board);

    // Verify markdown file on disk contains frontmatter and rendered markdown table body
    const nodeFiles = fs.readdirSync(path.join(tmpDir, 'table-board', 'sections', '02_architecture', 'nodes'));
    expect(nodeFiles.length).toBeGreaterThan(0);
    const tableMdFile = nodeFiles.find((f) => f.includes('table'));
    expect(tableMdFile).toBeDefined();

    const rawFileContent = fs.readFileSync(
      path.join(tmpDir, 'table-board', 'sections', '02_architecture', 'nodes', tableMdFile!),
      'utf8'
    );
    expect(rawFileContent).toContain('type: "table"');
    expect(rawFileContent).toContain('tableData:');
    expect(rawFileContent).toContain('| Option A');

    // 3. Reload board from disk and verify fidelity
    const reloaded = icm.loadBoardFromDisk('table-board');
    const reloadedTable = Object.values(reloaded.nodes).find((n) => n.type === 'table');
    expect(reloadedTable).toBeDefined();
    expect(reloadedTable!.content.tableData?.columns).toEqual(tableNode!.content.tableData?.columns);
    expect(reloadedTable!.content.tableData?.rows.length).toBe(tableNode!.content.tableData?.rows.length);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates clean boards and template boards (pipeline, retrospective)', () => {
    // 1. Clean board
    const clean = createEmptyBoard('clean-board', 'My Clean Whiteboard');
    expect(clean.name).toBe('clean-board');
    expect(clean.title).toBe('My Clean Whiteboard');
    expect(Object.keys(clean.sections).length).toBe(0);
    expect(Object.keys(clean.nodes).length).toBe(0);
    expect(Object.keys(clean.edges).length).toBe(0);

    // 2. Template: pipeline
    const pipeline = createBoardFromTemplate('video-pipeline', 'Video Content Pipeline', 'pipeline');
    expect(pipeline.name).toBe('video-pipeline');
    expect(Object.keys(pipeline.sections).length).toBe(4);
    expect(pipeline.sections['sec-01-brief']).toBeDefined();
    expect(pipeline.sections['sec-04-qa']).toBeDefined();
    expect(Object.keys(pipeline.nodes).length).toBeGreaterThanOrEqual(2);
    expect(pipeline.nodes['node-brief-1'].type).toBe('checklist');
    expect(Object.keys(pipeline.edges).length).toBeGreaterThanOrEqual(1);

    // 3. Template: retrospective
    const retro = createBoardFromTemplate('sprint-4-retro', 'Sprint 4 Retro', 'retrospective');
    expect(Object.keys(retro.sections).length).toBe(3);
    expect(retro.sections['sec-went-well']).toBeDefined();
    expect(retro.sections['sec-actions']).toBeDefined();
    expect(retro.nodes['node-retro-actions'].type).toBe('checklist');
  });

  it('supports freeform text nodes on canvas surface with flat styling and markdown body', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-text-'));
    const icm = new ICMAdapter(tmpDir);

    const board = createEmptyBoard('text-board', 'Text Canvas');
    applyOperations(board, [
      {
        op: 'create_node',
        node: {
          id: 'text-1',
          type: 'text',
          position: { x: 200, y: 150 },
          size: { width: 320, height: 80 },
          content: {
            title: '',
            body: '# Launch Milestone\n- Complete Phase 4 validation',
          },
          style: { color: '#38bdf8' },
        },
      },
    ]);

    expect(board.nodes['text-1']).toBeDefined();
    expect(board.nodes['text-1'].type).toBe('text');
    expect(board.nodes['text-1'].content.body).toContain('# Launch Milestone');

    // Save and reload to verify persistence
    icm.saveBoardToDisk(board);
    const reloaded = icm.loadBoardFromDisk('text-board');
    expect(reloaded.nodes['text-1']).toBeDefined();
    expect(reloaded.nodes['text-1'].type).toBe('text');
    expect(reloaded.nodes['text-1'].content.body).toContain('# Launch Milestone');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('auto-detects and seeds layout when mounting on an existing ICM workspace folder without _layout.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-mount-'));
    const boardDir = path.join(tmpDir, 'existing-icm');
    fs.mkdirSync(path.join(boardDir, 'sections', '01_research', 'nodes'), { recursive: true });
    fs.mkdirSync(path.join(boardDir, 'sections', '02_draft', 'nodes'), { recursive: true });

    // Write sample CONTEXT.md
    fs.writeFileSync(
      path.join(boardDir, 'sections', '01_research', 'CONTEXT.md'),
      '# ICM Section Contract: Research & Discovery (`01_research`)\n\n## 1. Purpose & Process\nAnalyze user interviews and market data.'
    );

    // Write sample node markdown
    fs.writeFileSync(
      path.join(boardDir, 'sections', '01_research', 'nodes', 'card-1.md'),
      '---\nid: card-1\ntype: sticky\ntitle: User Interview Insights\n---\nCustomers want faster pipeline turnarounds.'
    );

    const icm = new ICMAdapter(tmpDir);
    // ensureBoardLoaded without existing _layout.json should auto-detect the existing ICM stages!
    const board = icm.ensureBoardLoaded('existing-icm');

    expect(Object.keys(board.sections).length).toBe(2);
    expect(board.sections['sec-01_research']).toBeDefined();
    expect(board.sections['sec-01_research'].title).toContain('Research & Discovery');
    expect(board.sections['sec-01_research'].description).toContain('Analyze user interviews');
    expect(board.nodes['card-1']).toBeDefined();
    expect(board.nodes['card-1'].content.title).toBe('User Interview Insights');
    expect(board.nodes['card-1'].content.body).toContain('Customers want faster');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('duplicates and saves named boards under independent directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-dup-'));
    const icm = new ICMAdapter(tmpDir);

    const initial = createDefaultBoard('original-board', 'Original Board');
    icm.saveBoardToDisk(initial);

    // Duplicate board
    const copy = icm.duplicateBoard('original-board', 'duplicated-board', 'Duplicated Board Copy');
    expect(copy.name).toBe('duplicated-board');
    expect(copy.title).toBe('Duplicated Board Copy');
    expect(Object.keys(copy.sections).length).toBe(Object.keys(initial.sections).length);
    expect(Object.keys(copy.nodes).length).toBe(Object.keys(initial.nodes).length);

    // Verify disk files
    expect(fs.existsSync(path.join(tmpDir, 'duplicated-board', '_layout.json'))).toBe(true);

    // List boards
    const boards = icm.listBoards();
    expect(boards.length).toBe(2);
    expect(boards.some((b) => b.name === 'original-board')).toBe(true);
    expect(boards.some((b) => b.name === 'duplicated-board')).toBe(true);

    // Delete duplicated board
    const deleted = icm.deleteBoard('duplicated-board');
    expect(deleted).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'duplicated-board'))).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('cleans up node markdown files and section folders from disk when deleted to prevent redundant files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-cleanup-'));
    const icm = new ICMAdapter(tmpDir);

    const board = createDefaultBoard('cleanup-test', 'Cleanup Test Board');
    icm.saveBoardToDisk(board);

    const nodePath = path.join(tmpDir, 'cleanup-test', 'sections', '01_discovery', 'nodes', 'node-goal-1.md');
    const secDir = path.join(tmpDir, 'cleanup-test', 'sections', '01_discovery');
    const contextPath = path.join(secDir, 'CONTEXT.md');

    expect(fs.existsSync(nodePath)).toBe(true);
    expect(fs.existsSync(contextPath)).toBe(true);

    // 1. Delete node from board
    applyOperations(board, [{ op: 'delete_node', id: 'node-goal-1' }]);
    icm.saveBoardToDisk(board);

    // Node file MUST be deleted from disk
    expect(fs.existsSync(nodePath)).toBe(false);

    // 2. Delete section from board
    applyOperations(board, [{ op: 'delete_section', id: 'sec-01-discovery' }]);
    icm.saveBoardToDisk(board);

    // Section directory and its CONTEXT.md MUST be completely purged from disk
    expect(fs.existsSync(secDir)).toBe(false);

    // The other nodes that were inside sec-01-discovery are now re-parented into 00_scratchpad
    expect(board.nodes['node-goal-2'].sectionId).toBeUndefined();
    const scratchpadNode = path.join(tmpDir, 'cleanup-test', 'sections', '00_scratchpad', 'nodes', 'node-goal-2.md');
    expect(fs.existsSync(scratchpadNode)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
