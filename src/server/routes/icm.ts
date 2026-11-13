import { Router } from 'express';
import {
  compileCanvasToICMPipeline,
  ensureICMArchitectWorkspace,
  matchPipelinesForPrompt,
  runICMWalkTest,
} from '../../icm/architect.js';
import { attachBoardParamValidation, ServerContext } from '../context.js';

/**
 * Router handling live ICM Option A file inspection, ICM Architect pipeline listing
 * and compilation, and Cold-Agent Walk Test verification.
 */
export function createIcmRouter(ctx: ServerContext): Router {
  const router = attachBoardParamValidation(Router());
  const { icm, bus, getBoard, persistAndBroadcast } = ctx;

  // Inspect live ICM Option A files on disk (for the Glass-Box ICM-CCTV Drawer)
  router.get('/boards/:name/files', (req, res) => {
    const board = getBoard(req.params.name);
    res.json({
      boardDir: `boards/${board.name}`,
      files: icm.listBoardFiles(board.name),
    });
  });

  // List Top-Level Routing File (`CONTEXT.md`), `_config/`, and Registered Pipelines
  router.get('/boards/:name/icm/pipelines', (req, res) => {
    const board = getBoard(req.params.name);
    const boardDir = icm.getBoardDir(board.name);
    const meta = ensureICMArchitectWorkspace(boardDir, board);
    const queryPrompt = typeof req.query.prompt === 'string' ? req.query.prompt : '';
    const matched = queryPrompt ? matchPipelinesForPrompt(queryPrompt, meta.pipelines) : [];
    res.json({
      icmWorkspace: meta,
      matchedPipelines: matched,
    });
  });

  // Compile an ICM Pipeline from Whiteboard Brainstorm
  router.post('/boards/:name/icm/build-pipeline', (req, res) => {
    const board = getBoard(req.params.name);
    const boardDir = icm.getBoardDir(board.name);
    const {
      pipelineId,
      title,
      description,
      triggerIntents,
      sectionId,
      nodeIds,
      outputWidgetType,
      reflectOnCanvas = true,
    } = req.body || {};

    const compiled = compileCanvasToICMPipeline(boardDir, board, {
      pipelineId,
      title,
      description,
      triggerIntents: Array.isArray(triggerIntents)
        ? triggerIntents
        : typeof triggerIntents === 'string'
          ? triggerIntents.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      sectionId,
      nodeIds,
      outputWidgetType,
      reflectOnCanvas,
    });

    board.version += 1;
    persistAndBroadcast(board, 'icm-architect');
    bus.broadcastAgentActivity(
      board.name,
      'icm-architect',
      `🏗️ Built ICM Pipeline "${compiled.pipeline.title}" (${compiled.pipeline.stages.length} stages) — ${compiled.walkTest.summary}`
    );

    res.status(201).json({
      compiled,
      board,
    });
  });

  // Run Cold-Agent Walk Test Verification
  router.post('/boards/:name/icm/walk-test', (req, res) => {
    const board = getBoard(req.params.name);
    const boardDir = icm.getBoardDir(board.name);
    const walkTest = runICMWalkTest(boardDir, board.icmWorkspace?.pipelines);
    if (board.icmWorkspace) {
      board.icmWorkspace.lastWalkTest = walkTest;
    }
    res.json({ walkTest });
  });

  return router;
}
