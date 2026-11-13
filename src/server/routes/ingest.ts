import { Router } from 'express';
import { applyOperations } from '../../core/index.js';
import { attachBoardParamValidation, ServerContext } from '../context.js';

/**
 * Router handling webhook and external system ingestion into idempotent `data_card` nodes.
 */
export function createIngestRouter(ctx: ServerContext): Router {
  const router = attachBoardParamValidation(Router());
  const { bus, getBoard, persistAndBroadcast } = ctx;

  router.post('/boards/:name/ingest', (req, res) => {
    const board = getBoard(req.params.name);
    const {
      source = 'external-webhook',
      externalId,
      title,
      body = '',
      structuredData = {},
      status = 'active',
      url,
      sectionId,
    } = req.body || {};

    // Check idempotency if externalId already exists on board
    const existingNode = externalId
      ? Object.values(board.nodes).find(
          (n) => n.content.sourceMeta?.externalId === externalId
        )
      : undefined;

    const pin = Object.values(board.pins)[0];
    const targetSectionId =
      sectionId || pin?.targetSectionId || Object.keys(board.sections)[0];

    if (existingNode) {
      applyOperations(
        board,
        [
          {
            op: 'update_node',
            id: existingNode.id,
            patch: {
              content: {
                title: title || existingNode.content.title,
                body: body || existingNode.content.body,
                structuredData: {
                  ...existingNode.content.structuredData,
                  ...structuredData,
                },
                sourceMeta: {
                  provider: source,
                  externalId,
                  status,
                  url: url || existingNode.content.sourceMeta?.url,
                },
              },
            },
          },
        ],
        `ingest:${source}`
      );
    } else {
      applyOperations(
        board,
        [
          {
            op: 'create_node',
            node: {
              type: 'data_card',
              sectionId: targetSectionId,
              size: { width: 280, height: 185 },
              content: {
                title: title || `${source.toUpperCase()} Event`,
                body,
                structuredData,
                sourceMeta: {
                  provider: source,
                  externalId: externalId || `evt-${Date.now().toString(36)}`,
                  status,
                  url,
                },
              },
              style: { color: '#a7f3d0' },
            },
          },
        ],
        `ingest:${source}`
      );
    }

    persistAndBroadcast(board, `ingest:${source}`);
    bus.broadcastAgentActivity(
      board.name,
      `ingest:${source}`,
      `Rendered data card "${title || externalId || source}" onto board`
    );

    res.status(201).json({ board });
  });

  return router;
}
