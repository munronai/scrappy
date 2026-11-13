import { Router } from 'express';
import { extractSpatialSlice, PromptRequest } from '../../core/index.js';
import { attachBoardParamValidation, ServerContext } from '../context.js';
import {
  executeInstantAgentAction,
  executeStandaloneModelPrompt,
} from '../smartAgent.js';

/**
 * Router handling `@scrappy` prompt submission (ICM Mode and Standalone Model API)
 * and CLI/agent prompt resolution.
 */
export function createPromptsRouter(ctx: ServerContext): Router {
  const router = attachBoardParamValidation(Router());
  const { bus, getBoard, persistAndBroadcast } = ctx;

  // Submit or queue a @scrappy prompt
  router.post('/boards/:name/prompts', async (req, res) => {
    const board = getBoard(req.params.name);
    const {
      prompt,
      mode = 'icm',
      executionRoute,
      selectedPipelineId,
      anchorPosition,
      targetNodeId,
      selectedNodeIds,
      selectedSectionId,
      boundingBox,
      apiConfig,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    const normalizedMode: 'icm' | 'standalone_api' =
      mode === 'standalone_api' || mode === 'instant_local' ? 'standalone_api' : 'icm';

    const activeNodeIds = Array.isArray(selectedNodeIds)
      ? selectedNodeIds
      : board.activeSelection.nodeIds;

    const slice = extractSpatialSlice(board, {
      selectedOnly: activeNodeIds.length > 0,
      sectionId: selectedSectionId || board.activeSelection.sectionId,
      bbox: boundingBox || board.activeSelection.boundingBox,
    });

    const formattedPrompt = prompt.trim().toLowerCase().startsWith('@scrappy')
      ? prompt.trim()
      : `@scrappy ${prompt.trim()}`;

    const promptReq: PromptRequest = {
      id: `prompt-${Date.now().toString(36)}`,
      boardName: board.name,
      prompt: formattedPrompt,
      mode: normalizedMode,
      executionRoute: executionRoute || (selectedPipelineId ? 'pipeline' : 'adhoc'),
      selectedPipelineId,
      status: normalizedMode === 'standalone_api' ? 'processing' : 'pending',
      anchorPosition,
      targetNodeId,
      selectedNodeIds: activeNodeIds,
      selectedSectionId: selectedSectionId || board.activeSelection.sectionId,
      boundingBox: boundingBox || board.activeSelection.boundingBox,
      tokenEstimate: slice.tokenEstimate,
      createdAt: new Date().toISOString(),
    };

    board.prompts.push(promptReq);

    if (normalizedMode === 'standalone_api') {
      bus.updatePresence(board.name, {
        actorId: '@scrappy-api',
        name: '@scrappy (Model API)',
        role: 'agent',
        color: '#38bdf8',
        cursor: anchorPosition || {
          x: slice.nodes[0]?.position.x || 400,
          y: slice.nodes[0]?.position.y || 250,
        },
        statusText: `Processing: ${promptReq.prompt.slice(0, 38)}...`,
        updatedAt: Date.now(),
      });

      const result = await executeStandaloneModelPrompt(board, promptReq, apiConfig);
      promptReq.status = 'completed';
      promptReq.completedAt = new Date().toISOString();
      promptReq.agentResponseSummary = `${result.summary} [${result.usedProvider}]`;

      bus.broadcastAgentActivity(board.name, '@scrappy-api', promptReq.agentResponseSummary);
    } else {
      bus.broadcastAgentActivity(
        board.name,
        '@scrappy-icm',
        `Wrote "${promptReq.prompt}" to boards/${board.name}/_prompts/ACTIVE_PROMPT.md — run /update-scrappy in agy`
      );
    }

    board.version += 1;
    persistAndBroadcast(board, 'prompt-engine');
    res.status(201).json({ prompt: promptReq, board });
  });

  // Resolve a pending prompt (called by Antigravity CLI `npm run wb -- resolve-prompt`)
  router.post('/boards/:name/prompts/:promptId/resolve', (req, res) => {
    const board = getBoard(req.params.name);
    const { summary = 'Completed by Antigravity CLI', runInstantFallback = false } = req.body || {};
    const target = board.prompts.find((p) => p.id === req.params.promptId);

    if (!target) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    if (runInstantFallback) {
      const result = executeInstantAgentAction(board, target);
      target.agentResponseSummary = result.summary;
    } else {
      target.agentResponseSummary = summary;
    }

    target.status = 'completed';
    target.completedAt = new Date().toISOString();
    board.version += 1;
    persistAndBroadcast(board, 'antigravity-cli');
    bus.broadcastAgentActivity(board.name, 'antigravity-cli', target.agentResponseSummary!);

    res.json({ prompt: target, board });
  });

  return router;
}
