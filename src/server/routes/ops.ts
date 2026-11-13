import { Router } from 'express';
import {
  applyOperations,
  AutoLayoutKind,
  extractSpatialSlice,
  GraphOp,
  OpsBatchRequestSchema,
  synthesizeBoardToMarkdown,
  synthesizeBoardToMermaid,
} from '../../core/index.js';
import { attachBoardParamValidation, ServerContext } from '../context.js';

/**
 * Router handling board graph mutations (`ops`), auto-layout, spatial context slicing,
 * collaborator presence announcements, and Markdown/Mermaid exports.
 */
export function createOpsRouter(ctx: ServerContext): Router {
  const router = attachBoardParamValidation(Router());
  const { bus, getBoard, persistAndBroadcast } = ctx;

  // Get scoped spatial context slice (ICM Token Discipline)
  router.get('/boards/:name/context', (req, res) => {
    const board = getBoard(req.params.name);
    const selectedOnly = req.query.selected === 'true';
    const sectionId = req.query.sectionId as string | undefined;
    let bbox: { x: number; y: number; width: number; height: number } | undefined;
    if (typeof req.query.bbox === 'string') {
      const parts = req.query.bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
        bbox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
    }
    const slice = extractSpatialSlice(board, {
      selectedOnly,
      sectionId,
      bbox,
    });
    res.json({ slice });
  });

  // Apply batch of graph operations
  router.post('/boards/:name/ops', (req, res) => {
    const board = getBoard(req.params.name);
    const parsed = OpsBatchRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid graph operations payload',
        details: parsed.error.issues,
      });
      return;
    }

    const operations = parsed.data.operations as GraphOp[];
    const actorId = parsed.data.actorId;
    const autoLayout = parsed.data.autoLayout as AutoLayoutKind;

    applyOperations(board, operations, actorId, autoLayout);
    persistAndBroadcast(board, actorId, operations);

    if (actorId !== 'human') {
      bus.broadcastAgentActivity(
        board.name,
        actorId,
        `Applied ${operations.length} operation(s) to board`
      );
    }

    res.json({ board, version: board.version });
  });

  // Announce Agent / Collaborator Presence over HTTP (for CLI / MCP calls)
  router.post('/boards/:name/presence', (req, res) => {
    const board = getBoard(req.params.name);
    const {
      actorId = 'antigravity-cli',
      name = 'Antigravity CLI',
      role = 'agent',
      color = '#38bdf8',
      cursor = { x: 880, y: 220 },
      statusText = 'Inspecting whiteboard context...',
    } = req.body || {};

    bus.updatePresence(board.name, {
      actorId,
      name,
      role,
      color,
      cursor,
      statusText,
      updatedAt: Date.now(),
    });
    bus.broadcastAgentActivity(board.name, actorId, statusText);
    res.json({ ok: true, collaborators: bus.getPresence(board.name) });
  });

  // Export board to Markdown Doc or Mermaid diagram
  router.get('/boards/:name/export', (req, res) => {
    const board = getBoard(req.params.name);
    const format = (req.query.format as string) || 'markdown';
    const sectionId = req.query.sectionId as string | undefined;

    if (format === 'mermaid') {
      res.json({
        format: 'mermaid',
        content: synthesizeBoardToMermaid(board, sectionId),
      });
      return;
    }

    res.json({
      format: 'markdown',
      content: synthesizeBoardToMarkdown(board, sectionId),
    });
  });

  return router;
}
