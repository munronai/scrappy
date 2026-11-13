import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import chokidar, { FSWatcher } from 'chokidar';
import { WriteQueue, WriteQueueStats } from './writeQueue.js';
import {
  BoardDocument,
  BoardTemplateKind,
  CanvasEdge,
  CanvasNode,
  ChecklistItem,
  createBoardFromTemplate,
  createDefaultBoard,
  createEmptyBoard,
  extractChecklistFromMarkdown,
  extractSpatialSlice,
  extractTableFromMarkdown,
  formatTableToMarkdown,
  isValidBoardSlug,
  PromptRequest,
  sanitizePathSlug,
  SectionNode,
  TableData,
} from '../core/index.js';
import {
  ensureICMArchitectWorkspace,
  matchPipelinesForPrompt,
} from './architect.js';

export interface ICMLayoutFile {
  id: string;
  name: string;
  title: string;
  version: number;
  security: BoardDocument['security'];
  sections: Record<string, SectionNode>;
  nodeGeometry: Record<
    string,
    {
      position: { x: number; y: number };
      size: { width: number; height: number };
      style: CanvasNode['style'];
      type: CanvasNode['type'];
      sectionId?: string;
      lockedToSection?: boolean;
      icmFilePath?: string;
      suggestionMeta?: CanvasNode['suggestionMeta'];
    }
  >;
  edges: BoardDocument['edges'];
  pins: BoardDocument['pins'];
  activeSelection: BoardDocument['activeSelection'];
  prompts: PromptRequest[];
  updatedAt: string;
}

export interface ICMAdapterOptions {
  /** Idle debounce threshold in ms for `scheduleSaveBoard`. Default: 300ms. */
  writeDebounceMs?: number;
}

interface BoardWritePlan {
  boardDir: string;
  dirsToCreate: string[];
  filesToWrite: Array<{ filePath: string; content: string }>;
  activeNodeFiles: Set<string>;
  activeSectionSlugs: Set<string>;
}

export class ICMAdapter {
  private boardsRoot: string;
  private watchers = new Map<string, FSWatcher>();
  private fileContentHashes = new Map<string, string>();
  private writeQueue: WriteQueue;

  constructor(boardsRoot: string, options: ICMAdapterOptions = {}) {
    this.boardsRoot = boardsRoot;
    this.writeQueue = new WriteQueue({ debounceMs: options.writeDebounceMs ?? 300 });
    fs.mkdirSync(this.boardsRoot, { recursive: true });
  }

  private writeTrackedFile(filePath: string, content: string): void {
    const absPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    this.fileContentHashes.set(absPath, hash);
  }

  private async writeTrackedFileAsync(filePath: string, content: string): Promise<void> {
    const absPath = path.resolve(filePath);
    await fsPromises.mkdir(path.dirname(absPath), { recursive: true });
    await fsPromises.writeFile(absPath, content, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    this.fileContentHashes.set(absPath, hash);
  }

  /**
   * Enqueues an asynchronous, debounced (300ms default) disk save for `board`.
   * High-frequency drag/resize bursts coalesce into a single `node:fs/promises` write.
   */
  public scheduleSaveBoard(board: BoardDocument): void {
    const snapshot = structuredClone(board);
    this.writeQueue.enqueue(board.name, () => this.saveBoardToDiskAsync(snapshot));
  }

  /**
   * Flushes any pending or in-flight async board writes.
   */
  public async flushPendingWrites(boardName?: string): Promise<void> {
    await this.writeQueue.flush(boardName);
  }

  /**
   * Returns observability counters for the async write-behind queue.
   */
  public getWriteQueueStats(): WriteQueueStats {
    return this.writeQueue.getStats();
  }

  public getBoardDir(boardName: string): string {
    if (!isValidBoardSlug(boardName)) {
      throw new Error(
        `Invalid board name: "${boardName}". Only alphanumeric characters, dashes, and underscores (max 64) are allowed.`
      );
    }
    const resolved = path.resolve(this.boardsRoot, boardName);
    const rootResolved = path.resolve(this.boardsRoot);
    if (!resolved.startsWith(rootResolved + path.sep)) {
      throw new Error(`Directory traversal blocked for board name: "${boardName}".`);
    }
    return resolved;
  }

  public listBoards(): Array<{ name: string; title: string; updatedAt: string; nodeCount: number }> {
    if (!fs.existsSync(this.boardsRoot)) return [];
    const entries = fs.readdirSync(this.boardsRoot, { withFileTypes: true });
    const list: Array<{ name: string; title: string; updatedAt: string; nodeCount: number }> = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const layoutPath = path.join(this.boardsRoot, entry.name, '_layout.json');
        if (fs.existsSync(layoutPath)) {
          try {
            const raw = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')) as ICMLayoutFile;
            list.push({
              name: raw.name || entry.name,
              title: raw.title || entry.name,
              updatedAt: raw.updatedAt || new Date().toISOString(),
              nodeCount: Object.keys(raw.nodeGeometry || {}).length,
            });
          } catch {
            // ignore malformed
          }
        }
      }
    }
    return list;
  }

  public ensureBoardLoaded(
    boardName: string,
    defaultTitle?: string,
    template: BoardTemplateKind = 'default'
  ): BoardDocument {
    const boardDir = this.getBoardDir(boardName);
    const layoutPath = path.join(boardDir, '_layout.json');
    if (!fs.existsSync(layoutPath)) {
      // 1. Check for existing ICM workspace to mount without overwriting
      const seeded = this.detectAndSeedExistingICMWorkspace(boardName, defaultTitle);
      if (seeded) return seeded;

      // 2. Otherwise seed from requested template
      const initial = createBoardFromTemplate(boardName, defaultTitle, template);
      this.saveBoardToDisk(initial);
      return initial;
    }
    return this.loadBoardFromDisk(boardName);
  }

  public detectAndSeedExistingICMWorkspace(
    boardName: string,
    defaultTitle?: string
  ): BoardDocument | null {
    const boardDir = this.getBoardDir(boardName);
    if (!fs.existsSync(boardDir)) return null;

    // Check for existing sections/ or stages/ subdirectories
    let targetDir = path.join(boardDir, 'sections');
    let isStages = false;
    if (!fs.existsSync(targetDir)) {
      targetDir = path.join(boardDir, 'stages');
      isStages = true;
    }
    if (!fs.existsSync(targetDir)) return null;

    const stageEntries = fs
      .readdirSync(targetDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== '00_scratchpad')
      .sort((a, b) => a.name.localeCompare(b.name));

    if (stageEntries.length === 0) return null;

    const colors = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
    const sections: Record<string, SectionNode> = {};
    const nodes: Record<string, CanvasNode> = {};
    const edges: Record<string, CanvasEdge> = {};
    const now = new Date().toISOString();

    stageEntries.forEach((entry, idx) => {
      const slug = entry.name;
      const secId = `sec-${slug}`;
      const color = colors[idx % colors.length];
      const contextPath = path.join(targetDir, slug, 'CONTEXT.md');
      let title = slug.replace(/^(\d+)[-_]/, '$1. ').replace(/[-_]+/g, ' ');
      let desc = '';

      if (fs.existsSync(contextPath)) {
        const raw = fs.readFileSync(contextPath, 'utf-8');
        const titleMatch = raw.match(/^#\s+(?:ICM Section Contract:\s*)?(.+)$/m);
        if (titleMatch) title = titleMatch[1].replace(/\(`[^`]+`\)/, '').trim();
        const descMatch = raw.match(/##\s+1\.\s+Purpose[^\n]*\n+([^\n]+)/);
        if (descMatch) desc = descMatch[1].trim();
      }

      const bounds = {
        x: 80 + idx * 480,
        y: 100,
        width: 440,
        height: 500,
      };

      sections[secId] = {
        id: secId,
        slug,
        title,
        description: desc,
        bounds,
        color,
        icmContextPath: isStages ? `stages/${slug}/CONTEXT.md` : `sections/${slug}/CONTEXT.md`,
      };

      // Check for node files in nodes/ or output/
      let nodeFilesDir = path.join(targetDir, slug, 'nodes');
      if (!fs.existsSync(nodeFilesDir)) {
        nodeFilesDir = path.join(targetDir, slug, 'output');
      }

      if (fs.existsSync(nodeFilesDir)) {
        const files = fs
          .readdirSync(nodeFilesDir)
          .filter((f) => f.endsWith('.md'))
          .sort();
        files.forEach((f, nIdx) => {
          const nodeId = f.replace(/\.md$/, '');
          const fullPath = path.join(nodeFilesDir, f);
          const rawMd = fs.readFileSync(fullPath, 'utf-8');
          const parsed = this.parseNodeMarkdown(nodeId, rawMd);

          nodes[nodeId] = {
            id: nodeId,
            type: parsed.type || 'sticky',
            sectionId: secId,
            lockedToSection: true,
            position: {
              x: bounds.x + 20,
              y: bounds.y + 70 + nIdx * 160,
            },
            size: { width: 400, height: 140 },
            content: {
              title: parsed.title || f.replace(/\.md$/, ''),
              body: parsed.body,
              tags: parsed.tags,
              checklistItems: parsed.checklistItems,
              mermaidCode: parsed.mermaidCode,
              imageUrl: parsed.imageUrl,
              svgCode: parsed.svgCode,
              tableData: parsed.tableData,
              structuredData: parsed.structuredData,
            },
            style: {
              color:
                parsed.type === 'checklist' || parsed.type === 'table'
                  ? '#0f172a'
                  : '#fef08a',
            },
            icmFilePath: isStages
              ? `stages/${slug}/output/${f}`
              : `sections/${slug}/nodes/${f}`,
            updatedBy: 'icm-mount',
            updatedAt: now,
          };
        });
      }
    });

    const board: BoardDocument = {
      id: `board-${boardName}-${Date.now().toString(36)}`,
      name: boardName,
      title:
        defaultTitle ||
        boardName.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      version: 1,
      security: { mode: 'public' },
      sections,
      nodes,
      edges,
      pins: {},
      activeSelection: { nodeIds: [] },
      prompts: [],
      updatedAt: now,
    };

    this.saveBoardToDisk(board);
    return board;
  }

  public duplicateBoard(
    sourceName: string,
    targetName: string,
    newTitle?: string
  ): BoardDocument {
    const source = this.ensureBoardLoaded(sourceName);
    const finalSlug = targetName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const duplicated: BoardDocument = {
      ...JSON.parse(JSON.stringify(source)),
      id: `board-${finalSlug}-${Date.now().toString(36)}`,
      name: finalSlug,
      title: newTitle || `${source.title} (Copy)`,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    this.saveBoardToDisk(duplicated);
    return duplicated;
  }

  public deleteBoard(boardName: string): boolean {
    const boardDir = this.getBoardDir(boardName);
    this.writeQueue.cancel(boardName);
    if (this.watchers.has(boardName)) {
      this.watchers.get(boardName)?.close();
      this.watchers.delete(boardName);
    }
    if (fs.existsSync(boardDir)) {
      fs.rmSync(boardDir, { recursive: true, force: true });
      return true;
    }
    return false;
  }

  private prepareBoardWritePlan(board: BoardDocument): BoardWritePlan {
    const boardDir = this.getBoardDir(board.name);
    const dirsToCreate: string[] = [
      boardDir,
      path.join(boardDir, '_prompts'),
      path.join(boardDir, 'sections', '00_scratchpad', 'nodes'),
    ];
    const filesToWrite: Array<{ filePath: string; content: string }> = [];

    // 1. Section directories & CONTEXT.md files (ICM Stage Contracts)
    for (const sec of Object.values(board.sections)) {
      const safeSlug = sanitizePathSlug(sec.slug, 'section');
      const secDir = path.resolve(boardDir, 'sections', safeSlug);
      if (!secDir.startsWith(path.resolve(boardDir) + path.sep)) {
        continue;
      }
      const nodesDir = path.join(secDir, 'nodes');
      dirsToCreate.push(nodesDir);

      const contextPath = path.join(secDir, 'CONTEXT.md');
      const secNodes = Object.values(board.nodes).filter((n) => n.sectionId === sec.id);
      const contextMd = [
        `# ICM Section Contract: ${sec.title} (\`${safeSlug}\`)`,
        '',
        `> **Section ID:** \`${sec.id}\` | **Bounds:** \`(${sec.bounds.x}, ${sec.bounds.y}, ${sec.bounds.width}x${sec.bounds.height})\``,
        '',
        `## 1. Purpose & Process`,
        sec.description || 'Group and refine cards placed inside this spatial section.',
        '',
        `## 2. Active Nodes in Section (${secNodes.length})`,
        ...secNodes.map(
          (n) =>
            `- [\`${n.id}\`](./nodes/${sanitizePathSlug(n.id, 'node')}.md) — **${n.content.title || 'Untitled'}** (${n.type})`
        ),
        '',
      ].join('\n');
      filesToWrite.push({ filePath: contextPath, content: contextMd });
    }

    // 2. Option A: One Markdown file per Node (`sections/<slug>/nodes/<id>.md`)
    const activeNodeFiles = new Set<string>();
    const nodeGeometry: ICMLayoutFile['nodeGeometry'] = {};

    for (const node of Object.values(board.nodes)) {
      const secSlug =
        node.sectionId && board.sections[node.sectionId]
          ? board.sections[node.sectionId].slug
          : '00_scratchpad';
      const safeSecSlug = sanitizePathSlug(secSlug, 'scratchpad');
      const safeNodeId = sanitizePathSlug(node.id, 'node');
      const relFilePath = `sections/${safeSecSlug}/nodes/${safeNodeId}.md`;
      node.icmFilePath = relFilePath;
      const absNodePath = path.resolve(boardDir, relFilePath);
      if (!absNodePath.startsWith(path.resolve(boardDir) + path.sep)) {
        continue;
      }

      const serialized = this.serializeNodeMarkdown(node, safeSecSlug);
      filesToWrite.push({ filePath: absNodePath, content: serialized });
      activeNodeFiles.add(absNodePath);

      nodeGeometry[node.id] = {
        position: node.position,
        size: node.size,
        style: node.style,
        type: node.type,
        sectionId: node.sectionId,
        lockedToSection: node.lockedToSection,
        icmFilePath: relFilePath,
        suggestionMeta: node.suggestionMeta,
      };
    }

    const activeSectionSlugs = new Set<string>(
      Object.values(board.sections).map((s) => s.slug)
    );
    activeSectionSlugs.add('00_scratchpad');

    // 3. `_layout.json` (ICM-CCTV Spatial Metadata)
    const layoutData: ICMLayoutFile = {
      id: board.id,
      name: board.name,
      title: board.title,
      version: board.version,
      security: board.security,
      sections: board.sections,
      nodeGeometry,
      edges: board.edges,
      pins: board.pins,
      activeSelection: board.activeSelection,
      prompts: board.prompts,
      updatedAt: board.updatedAt,
    };
    filesToWrite.push({
      filePath: path.join(boardDir, '_layout.json'),
      content: JSON.stringify(layoutData, null, 2),
    });

    // 4. `BOARD_MAP.md` & `_prompts/ACTIVE_PROMPT.md`
    filesToWrite.push({
      filePath: path.join(boardDir, 'BOARD_MAP.md'),
      content: this.generateBoardMapMarkdown(board),
    });
    filesToWrite.push({
      filePath: path.join(boardDir, '_prompts', 'ACTIVE_PROMPT.md'),
      content: this.buildActivePromptContract(board),
    });

    return {
      boardDir,
      dirsToCreate,
      filesToWrite,
      activeNodeFiles,
      activeSectionSlugs,
    };
  }

  public async saveBoardToDiskAsync(board: BoardDocument): Promise<void> {
    const plan = this.prepareBoardWritePlan(board);
    this.markWriting(board.name);

    await Promise.all(
      plan.dirsToCreate.map((dir) => fsPromises.mkdir(dir, { recursive: true }))
    );

    await Promise.all(
      plan.filesToWrite.map((f) => this.writeTrackedFileAsync(f.filePath, f.content))
    );

    // Clean up deleted node markdown files and deleted section directories
    const sectionsDir = path.join(plan.boardDir, 'sections');
    try {
      const secEntries = await fsPromises.readdir(sectionsDir, { withFileTypes: true });
      for (const secEntry of secEntries) {
        if (!secEntry.isDirectory()) continue;
        const secSlug = secEntry.name;
        const secPath = path.join(sectionsDir, secSlug);

        if (!plan.activeSectionSlugs.has(secSlug)) {
          await fsPromises.rm(secPath, { recursive: true, force: true }).catch(() => {});
          continue;
        }

        const nodesDir = path.join(secPath, 'nodes');
        try {
          const files = await fsPromises.readdir(nodesDir);
          await Promise.all(
            files
              .filter((f) => f.endsWith('.md') && !plan.activeNodeFiles.has(path.join(nodesDir, f)))
              .map((f) => fsPromises.unlink(path.join(nodesDir, f)).catch(() => {}))
          );
        } catch {
          // nodesDir may not exist yet
        }
      }
    } catch {
      // sectionsDir may not exist yet
    }

    ensureICMArchitectWorkspace(plan.boardDir, board);
  }

  public saveBoardToDisk(board: BoardDocument): void {
    const plan = this.prepareBoardWritePlan(board);
    this.markWriting(board.name);

    for (const dir of plan.dirsToCreate) {
      fs.mkdirSync(dir, { recursive: true });
    }

    for (const file of plan.filesToWrite) {
      this.writeTrackedFile(file.filePath, file.content);
    }

    const sectionsDir = path.join(plan.boardDir, 'sections');
    if (fs.existsSync(sectionsDir)) {
      for (const secEntry of fs.readdirSync(sectionsDir, { withFileTypes: true })) {
        if (!secEntry.isDirectory()) continue;
        const secSlug = secEntry.name;
        const secPath = path.join(sectionsDir, secSlug);

        // If the section was deleted from the board, purge its directory and CONTEXT.md
        if (!plan.activeSectionSlugs.has(secSlug)) {
          try {
            fs.rmSync(secPath, { recursive: true, force: true });
          } catch {
            // ignore
          }
          continue;
        }

        const nodesDir = path.join(secPath, 'nodes');
        if (!fs.existsSync(nodesDir)) continue;
        for (const f of fs.readdirSync(nodesDir)) {
          if (!f.endsWith('.md')) continue;
          const full = path.join(nodesDir, f);
          if (!plan.activeNodeFiles.has(full)) {
            try {
              fs.unlinkSync(full);
            } catch {
              // ignore
            }
          }
        }
      }
    }

    // Write Top-Level ICM Architect Routing `CONTEXT.md` + `pipelines/*`
    ensureICMArchitectWorkspace(plan.boardDir, board);
  }

  public loadBoardFromDisk(boardName: string): BoardDocument {
    const boardDir = this.getBoardDir(boardName);
    const layoutPath = path.join(boardDir, '_layout.json');
    if (!fs.existsSync(layoutPath)) {
      return createDefaultBoard(boardName);
    }

    const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8')) as ICMLayoutFile;
    const nodes: Record<string, CanvasNode> = {};

    // Read all node markdown files across `sections/*/nodes/*.md`
    const sectionsDir = path.join(boardDir, 'sections');
    if (fs.existsSync(sectionsDir)) {
      const secEntries = fs.readdirSync(sectionsDir, { withFileTypes: true });
      for (const secEntry of secEntries) {
        if (!secEntry.isDirectory()) continue;
        const secSlug = secEntry.name;
        const matchedSection = Object.values(layout.sections || {}).find(
          (s) => s.slug === secSlug
        );
        const nodesDir = path.join(sectionsDir, secSlug, 'nodes');
        if (!fs.existsSync(nodesDir)) continue;

        for (const file of fs.readdirSync(nodesDir)) {
          if (!file.endsWith('.md')) continue;
          const nodeId = file.replace(/\.md$/, '');
          const fullPath = path.join(nodesDir, file);
          const rawMd = fs.readFileSync(fullPath, 'utf-8');
          const parsed = this.parseNodeMarkdown(nodeId, rawMd);
          const geom = layout.nodeGeometry?.[nodeId];

          const resolvedSecId = matchedSection?.id ?? geom?.sectionId;
          nodes[nodeId] = {
            id: nodeId,
            type: parsed.type || geom?.type || 'sticky',
            sectionId: resolvedSecId,
            lockedToSection: geom?.lockedToSection ?? Boolean(resolvedSecId),
            position: geom?.position || {
              x: (matchedSection?.bounds.x || 100) + 40,
              y: (matchedSection?.bounds.y || 100) + 80,
            },
            size: geom?.size || { width: 250, height: 150 },
            content: {
              title: parsed.title || 'Untitled Note',
              body: parsed.body,
              tags: parsed.tags,
              checklistItems: parsed.checklistItems,
              mermaidCode: parsed.mermaidCode,
              imageUrl: parsed.imageUrl,
              svgCode: parsed.svgCode,
              tableData: parsed.tableData,
              structuredData: parsed.structuredData,
              sourceMeta: parsed.sourceMeta,
            },
            style: {
              color: parsed.color || geom?.style?.color || '#fef08a',
              shape: parsed.shape || geom?.style?.shape || 'rect',
            },
            suggestionMeta: geom?.suggestionMeta,
            icmFilePath: `sections/${secSlug}/nodes/${file}`,
            updatedBy: parsed.updatedBy || 'icm-file',
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }
    }

    const loadedBoard: BoardDocument = {
      id: layout.id || `board-${boardName}`,
      name: layout.name || boardName,
      title: layout.title || boardName,
      version: layout.version || 1,
      security: layout.security || { mode: 'public' },
      sections: layout.sections || {},
      nodes,
      edges: layout.edges || {},
      pins: layout.pins || {},
      activeSelection: layout.activeSelection || { nodeIds: [] },
      prompts: layout.prompts || [],
      updatedAt: layout.updatedAt || new Date().toISOString(),
    };
    this.markWriting(boardName);
    ensureICMArchitectWorkspace(boardDir, loadedBoard);
    return loadedBoard;
  }

  public watchBoard(
    boardName: string,
    onExternalChange: (updatedBoard: BoardDocument, changedFile: string) => void
  ): void {
    if (this.watchers.has(boardName)) return;
    const boardDir = this.getBoardDir(boardName);
    fs.mkdirSync(boardDir, { recursive: true });

    const watcher = chokidar.watch(boardDir, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 80,
        pollInterval: 30,
      },
    });

    const handleFsEvent = (filePath: string) => {
      const fullPath = path.resolve(boardDir, filePath);
      if (
        filePath.endsWith('BOARD_MAP.md') ||
        filePath.endsWith('ACTIVE_PROMPT.md') ||
        filePath.endsWith('_prompts/ACTIVE_PROMPT.md')
      ) {
        return;
      }

      // Check SHA-256 hash to prevent echo loops while reliably catching external changes
      if (fs.existsSync(fullPath)) {
        try {
          const currentContent = fs.readFileSync(fullPath, 'utf-8');
          const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
          const lastKnown = this.fileContentHashes.get(fullPath);
          if (lastKnown === currentHash) {
            // Echo write from this process. Safely ignore!
            return;
          }
          this.fileContentHashes.set(fullPath, currentHash);
        } catch {
          return;
        }
      }

      try {
        const updated = this.loadBoardFromDisk(boardName);
        updated.version += 1;
        this.saveBoardToDisk(updated);
        onExternalChange(updated, path.relative(boardDir, filePath));
      } catch (err) {
        console.error(`[ICM Watcher] Error reloading board ${boardName}:`, err);
      }
    };

    watcher.on('add', handleFsEvent);
    watcher.on('change', handleFsEvent);
    watcher.on('unlink', handleFsEvent);

    this.watchers.set(boardName, watcher);
  }

  public listBoardFiles(boardName: string): Array<{ path: string; size: number; preview: string }> {
    const boardDir = this.getBoardDir(boardName);
    if (!fs.existsSync(boardDir)) return [];
    const results: Array<{ path: string; size: number; preview: string }> = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const stat = fs.statSync(full);
          const content = fs.readFileSync(full, 'utf-8');
          results.push({
            path: path.relative(boardDir, full),
            size: stat.size,
            preview: content.slice(0, 1200),
          });
        }
      }
    };
    walk(boardDir);
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  private markWriting(_boardName: string): void {
    // Retained for backwards compatibility; file synchronization is tracked via SHA-256 hashes
  }

  private serializeNodeMarkdown(node: CanvasNode, secSlug: string): string {
    const frontmatter: Record<string, unknown> = {
      id: node.id,
      type: node.type,
      section: secSlug,
      title: node.content.title || 'Untitled Note',
      color: node.style.color,
      shape: node.style.shape || 'rect',
      tags: node.content.tags || [],
      updatedBy: node.updatedBy,
      updatedAt: node.updatedAt,
    };
    if (node.content.sourceMeta) {
      frontmatter.sourceMeta = node.content.sourceMeta;
    }
    if (node.content.structuredData) {
      frontmatter.structuredData = node.content.structuredData;
    }
    if (node.content.checklistItems) {
      frontmatter.checklistItems = node.content.checklistItems;
    }
    if (node.content.mermaidCode) {
      frontmatter.mermaidCode = node.content.mermaidCode;
    }
    if (node.content.imageUrl) {
      frontmatter.imageUrl = node.content.imageUrl;
    }
    if (node.content.svgCode) {
      frontmatter.svgCode = node.content.svgCode;
    }
    if (node.content.tableData) {
      frontmatter.tableData = node.content.tableData;
    }

    const lines = [
      '---',
      `id: ${ JSON.stringify(frontmatter.id) }`,
      `type: ${ JSON.stringify(frontmatter.type) }`,
      `section: ${ JSON.stringify(frontmatter.section) }`,
      `title: ${ JSON.stringify(frontmatter.title) }`,
      `color: ${ JSON.stringify(frontmatter.color) }`,
      `shape: ${ JSON.stringify(frontmatter.shape) }`,
      `tags: ${ JSON.stringify(frontmatter.tags) }`,
      `updatedBy: ${ JSON.stringify(frontmatter.updatedBy) }`,
      `updatedAt: ${ JSON.stringify(frontmatter.updatedAt) }`,
    ];
    if (frontmatter.sourceMeta) {
      lines.push(`sourceMeta: ${JSON.stringify(frontmatter.sourceMeta)}`);
    }
    if (frontmatter.structuredData) {
      lines.push(`structuredData: ${JSON.stringify(frontmatter.structuredData)}`);
    }
    if (frontmatter.checklistItems) {
      lines.push(`checklistItems: ${JSON.stringify(frontmatter.checklistItems)}`);
    }
    if (frontmatter.mermaidCode) {
      lines.push(`mermaidCode: ${JSON.stringify(frontmatter.mermaidCode)}`);
    }
    if (frontmatter.imageUrl) {
      lines.push(`imageUrl: ${JSON.stringify(frontmatter.imageUrl)}`);
    }
    if (frontmatter.svgCode) {
      lines.push(`svgCode: ${JSON.stringify(frontmatter.svgCode)}`);
    }
    if (frontmatter.tableData) {
      lines.push(`tableData: ${JSON.stringify(frontmatter.tableData)}`);
    }
    const bodyText =
      node.type === 'table' && node.content.tableData
        ? formatTableToMarkdown(node.content.tableData)
        : node.content.body || '';
    lines.push('---', '', `# ${node.content.title || 'Untitled Note'}`, '', bodyText);
    return lines.join('\n') + '\n';
  }

  private parseNodeMarkdown(
    nodeId: string,
    raw: string
  ): {
    type?: CanvasNode['type'];
    title?: string;
    body: string;
    color?: string;
    shape?: CanvasNode['style']['shape'];
    tags?: string[];
    checklistItems?: ChecklistItem[];
    mermaidCode?: string;
    imageUrl?: string;
    svgCode?: string;
    tableData?: TableData;
    updatedBy?: string;
    updatedAt?: string;
    sourceMeta?: CanvasNode['content']['sourceMeta'];
    structuredData?: Record<string, unknown>;
  } {
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const meta: Record<string, unknown> = {};
    let bodyContent = raw;

    if (fmMatch) {
      const fmLines = fmMatch[1].split(/\r?\n/);
      for (const line of fmLines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const valStr = line.slice(colonIdx + 1).trim();
          try {
            meta[key] = JSON.parse(valStr);
          } catch {
            meta[key] = valStr.replace(/^["']|["']$/g, '');
          }
        }
      }
      bodyContent = fmMatch[2].trim();
    }

    // Strip leading `# Heading` if it duplicates the title
    let extractedHeading: string | undefined;
    const headingMatch = bodyContent.match(/^#\s+(.+)\r?\n+/);
    if (headingMatch) {
      extractedHeading = headingMatch[1].trim();
      bodyContent = bodyContent.slice(headingMatch[0].length).trim();
    }

    // Auto-detect interactive checklist items from frontmatter OR markdown `- [ ]` lines!
    const checklistItems =
      (Array.isArray(meta.checklistItems) ? (meta.checklistItems as ChecklistItem[]) : undefined) ||
      extractChecklistFromMarkdown(bodyContent);

    // Auto-detect Mermaid fenced code block if present
    let mermaidCode = typeof meta.mermaidCode === 'string' ? meta.mermaidCode : undefined;
    const mermaidMatch = bodyContent.match(/```mermaid\r?\n([\s\S]*?)```/);
    if (!mermaidCode && mermaidMatch) {
      mermaidCode = mermaidMatch[1].trim();
    }

    // Auto-detect Table data from frontmatter OR markdown table!
    const tableData =
      (meta.tableData as TableData | undefined) || extractTableFromMarkdown(bodyContent);

    let resolvedType = meta.type as CanvasNode['type'] | undefined;
    if ((!resolvedType || resolvedType === 'sticky') && checklistItems && checklistItems.length > 0) {
      resolvedType = 'checklist';
    } else if ((!resolvedType || resolvedType === 'sticky') && mermaidCode) {
      resolvedType = 'mermaid';
    } else if ((!resolvedType || resolvedType === 'sticky') && tableData) {
      resolvedType = 'table';
    }

    return {
      type: resolvedType,
      title: (meta.title as string) || extractedHeading || nodeId,
      body: bodyContent,
      color: meta.color as string | undefined,
      shape: meta.shape as CanvasNode['style']['shape'] | undefined,
      tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : undefined,
      checklistItems,
      mermaidCode,
      imageUrl: typeof meta.imageUrl === 'string' ? meta.imageUrl : undefined,
      svgCode: typeof meta.svgCode === 'string' ? meta.svgCode : undefined,
      tableData,
      updatedBy: meta.updatedBy as string | undefined,
      updatedAt: meta.updatedAt as string | undefined,
      sourceMeta: meta.sourceMeta as CanvasNode['content']['sourceMeta'] | undefined,
      structuredData: meta.structuredData as Record<string, unknown> | undefined,
    };
  }

  private generateBoardMapMarkdown(board: BoardDocument): string {
    const sections = Object.values(board.sections).sort((a, b) => a.slug.localeCompare(b.slug));
    const pendingPrompts = board.prompts.filter(
      (p) => p.status === 'pending' || p.status === 'processing'
    );

    const lines = [
      `# ICM Root Routing Map: ${board.title} (\`${board.name}\`)`,
      '',
      `> **Board Version:** \`v${board.version}\` | **Total Nodes:** \`${Object.keys(board.nodes).length}\` | **Total Edges:** \`${Object.keys(board.edges).length}\``,
      `> **ICM Granularity:** Option A (Node-per-file under \`sections/<slug>/nodes/<id>.md\` + \`_layout.json\`)`,
      '',
      `## 1. How Antigravity CLI (\`agy\`) Interacts with This Board`,
      `- **Fast CLI (Recommended):** Run \`npm run wb -- context --board ${board.name} --selected\` or \`npm run wb -- help\``,
      `- **Active User Prompts:** Check [\`_prompts/ACTIVE_PROMPT.md\`](./_prompts/ACTIVE_PROMPT.md) (${pendingPrompts.length} pending)`,
      `- **Direct ICM File Edit:** Edit or create any \`.md\` file inside \`sections/<slug>/nodes/\` and the React Canvas updates live in <50ms!`,
      '',
      `## 2. Spatial Sections Index (Token-Scoped Stages)`,
      ...sections.map((s) => {
        const count = Object.values(board.nodes).filter((n) => n.sectionId === s.id).length;
        return `- **[${s.title}](./sections/${s.slug}/CONTEXT.md)** (\`sections/${s.slug}/\`) — ${count} nodes — *${s.description || 'No description'}*`;
      }),
      '',
      `## 3. Current User Selection on Canvas`,
      board.activeSelection.nodeIds.length > 0
        ? `- Selected Node IDs: ${board.activeSelection.nodeIds.map((id) => `\`${id}\``).join(', ')}`
        : `- No specific region selected (Defaulting to board-level overview).`,
      '',
    ];
    return lines.join('\n');
  }

  private buildActivePromptContract(board: BoardDocument): string {
    const latestPending =
      [...board.prompts]
        .reverse()
        .find((p) => p.status === 'pending' || p.status === 'processing') ||
      board.prompts[board.prompts.length - 1];

    if (!latestPending) {
      return [
        `# Active @scrappy Prompt Queue (\`${board.name}\`)`,
        '',
        `> **Status:** \`IDLE\` (No pending @scrappy prompts in queue)`,
        '',
        `Right-click anywhere on the whiteboard canvas and address \`@scrappy ...\` (by typing or voice dictating) to write a scoped ICM task contract here, then run \`/update-scrappy\` in Antigravity CLI (\`agy\`).`,
        '',
        `You can also inspect or modify the board anytime using:`,
        '```bash',
        `npm run wb -- context --board ${board.name}`,
        `npm run wb -- add-node --board ${board.name} --title "New Idea" --body "Details..." --section sec-01-discovery`,
        '```',
      ].join('\n');
    }

    const slice = extractSpatialSlice(board, {
      selectedOnly: latestPending.selectedNodeIds.length > 0,
      sectionId: latestPending.selectedSectionId,
      bbox: latestPending.boundingBox,
    });

    const anchorXRaw = Math.round(latestPending.anchorPosition?.x ?? 400);
    const anchorYRaw = Math.round(latestPending.anchorPosition?.y ?? 260);
    const containingSec = latestPending.anchorPosition
      ? Object.values(board.sections).find(
          (s) =>
            anchorXRaw >= s.bounds.x &&
            anchorXRaw <= s.bounds.x + s.bounds.width &&
            anchorYRaw >= s.bounds.y &&
            anchorYRaw <= s.bounds.y + s.bounds.height
        )
      : undefined;

    const targetSec =
      (latestPending.selectedSectionId
        ? board.sections[latestPending.selectedSectionId]
        : undefined) || containingSec;

    // Ensure output position respects the Focus Region boundingBox or explicit Scope Section!
    let anchorX = anchorXRaw;
    let anchorY = anchorYRaw;
    if (latestPending.boundingBox) {
      const b = latestPending.boundingBox;
      anchorX = Math.max(Math.round(b.x + 20), Math.min(anchorX, Math.round(b.x + b.width - 260)));
      anchorY = Math.max(Math.round(b.y + 20), Math.min(anchorY, Math.round(b.y + b.height - 150)));
    } else if (latestPending.selectedSectionId && targetSec) {
      const b = targetSec.bounds;
      if (anchorX < b.x || anchorX > b.x + b.width || anchorY < b.y || anchorY > b.y + b.height) {
        const secNodes = Object.values(board.nodes).filter((n) => n.sectionId === targetSec.id);
        const col = secNodes.length % 2;
        const row = Math.floor(secNodes.length / 2);
        anchorX = Math.round(b.x + 30 + col * 285);
        anchorY = Math.round(b.y + 75 + row * 175);
      }
    }

    const pipelines = board.icmWorkspace?.pipelines || [];
    const matchedPipelines = matchPipelinesForPrompt(latestPending.prompt, pipelines);
    const activePipeline =
      (latestPending.selectedPipelineId
        ? pipelines.find((p) => p.id === latestPending.selectedPipelineId)
        : undefined) ||
      (latestPending.executionRoute === 'pipeline' ? matchedPipelines[0] : undefined);

    const routeLabel =
      latestPending.executionRoute === 'scaffold_pipeline'
        ? '🏗️ SCAFFOLD NEW ICM PIPELINE (icm-architect)'
        : activePipeline && latestPending.executionRoute !== 'adhoc'
          ? `🎯 GOVERNED ICM PIPELINE: ${activePipeline.title} (${activePipeline.id})`
          : '🧠 AD-HOC AGENT DECISION (Freeform @scrappy)';

    return [
      `# 🎯 ACTIVE @scrappy PROMPT FOR \`/update-scrappy\` (\`agy\`)`,
      '',
      `- **Prompt ID:** \`${latestPending.id}\``,
      `- **Board:** \`${board.name}\` (${board.title})`,
      `- **Status:** \`${latestPending.status.toUpperCase()}\``,
      `- **Execution Route:** **${routeLabel}**`,
      `- **Top-Level ICM Routing File:** [\`boards/${board.name}/CONTEXT.md\`](../CONTEXT.md)`,
      ...(activePipeline && latestPending.executionRoute !== 'adhoc'
        ? [
            `- **Selected ICM Pipeline Contract:** [\`boards/${board.name}/${activePipeline.routingPath}\`](../${activePipeline.routingPath})`,
            `- **Pipeline Shared Configs (\`_config/\`):** ${activePipeline.configRefs.map((c) => `\`boards/${board.name}/${c}\``).join(', ')}`,
            `- **Pipeline Stage Sequence:** ${activePipeline.stages.map((s) => `\`${s}\``).join(' → ')}`,
          ]
        : matchedPipelines.length > 0
          ? [
              `- **Available Matching ICM Pipelines (if Needed):** ${matchedPipelines.map((p) => `\`${p.id}\` (\`boards/${board.name}/${p.routingPath}\`)`).join(', ')}`,
            ]
          : []),
      `- **Scoped Output Coordinates:** \`(x: ${anchorX}, y: ${anchorY})\``,
      `- **Target Scope Section:** \`${targetSec?.id || '00_scratchpad'}\` (${targetSec?.title || 'Scratchpad'})`,
      ...(latestPending.boundingBox
        ? [
            `- **Focus Region Bounding Box:** \`x=${Math.round(latestPending.boundingBox.x)}, y=${Math.round(latestPending.boundingBox.y)}, w=${Math.round(latestPending.boundingBox.width)}, h=${Math.round(latestPending.boundingBox.height)}\``,
          ]
        : []),
      ...(latestPending.targetNodeId
        ? [`- **Right-Clicked Card:** \`${latestPending.targetNodeId}\``]
        : []),
      `- **Scoped Context:** ${slice.scopeDescription} (~${slice.tokenEstimate} tokens — ICM Scoped)`,
      `- **Created At:** ${latestPending.createdAt}`,
      '',
      `## @scrappy User Instruction`,
      `> "${latestPending.prompt}"`,
      '',
      `## Scoped Spatial Context (Nodes in Focus)`,
      ...slice.nodes.map((n) => {
        const checklistSummary = n.content.checklistItems
          ? ` | Checklist: ${n.content.checklistItems.map((i) => `[${i.checked ? 'x' : ' '}] ${i.text}`).join('; ')}`
          : '';
        return `- **\`${n.id}\`** [${n.type}] (Section: \`${n.sectionId || 'scratchpad'}\`, Pos: \`${Math.round(n.position.x)},${Math.round(n.position.y)}\`): **${n.content.title}** — ${n.content.body}${checklistSummary} *(File: \`boards/${board.name}/${n.icmFilePath}\`)*`;
      }),
      '',
      `## Connected Edges in Scope`,
      ...(slice.edges.length > 0
        ? slice.edges.map(
            (e) => `- \`${e.fromNodeId}\` --(${e.label || 'connects'})--> \`${e.toNodeId}\``
          )
        : ['- *(No edges in current scope)*']),
      '',
      `## How \`/update-scrappy\` Fulfills This Prompt`,
      `1. **Announce Presence at Right-Click Anchor:**`,
      '```bash',
      `npm run wb -- presence --board ${board.name} --x ${anchorX} --y ${anchorY} --status "Running /update-scrappy: ${latestPending.prompt.replace(/"/g, "'").slice(0, 40)}..."`,
      '```',
      `2. **Apply Changes at Anchor (\`--x ${anchorX} --y ${anchorY}\`) via CLI or Edit ICM Markdown Files Directly:**`,
      '```bash',
      `# Option 1: Add custom nodes/edges tailored to the @scrappy prompt:`,
      `npm run wb -- add-node --board ${board.name} --type sticky --title "New Step" --body "Description" --x ${anchorX} --y ${anchorY} --section ${latestPending.selectedSectionId || slice.sections[0]?.id || 'sec-01-discovery'}`,
      `npm run wb -- connect --board ${board.name} --from <nodeId1> --to <nodeId2> --label "leads to"`,
      `# Option 2: Or auto-execute the queued prompt directly:`,
      `npm run wb -- resolve-prompt --board ${board.name} --prompt-id ${latestPending.id} --auto`,
      '```',
      `3. **Mark Prompt Completed (if using Option 1):**`,
      '```bash',
      `npm run wb -- resolve-prompt --board ${board.name} --prompt-id ${latestPending.id} --summary "Fulfilled @scrappy prompt via /update-scrappy"`,
      '```',
    ].join('\n');
  }
}
