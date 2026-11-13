import { BoardDocument, BoundingBox, SpatialContextSlice } from './types.js';

/**
 * Extracts a token-disciplined spatial slice of the board by selection, section, or bounding box.
 */
export function extractSpatialSlice(
  board: BoardDocument,
  options: {
    selectedOnly?: boolean;
    sectionId?: string;
    bbox?: BoundingBox;
    includeConnected?: boolean;
  } = {}
): SpatialContextSlice {
  let matchedNodes = Object.values(board.nodes);
  let scopeDescription = 'Full Board Context';

  if (options.selectedOnly && board.activeSelection.nodeIds.length > 0) {
    const selSet = new Set(board.activeSelection.nodeIds);
    matchedNodes = matchedNodes.filter((n) => selSet.has(n.id));
    scopeDescription = `User Region Selection (${matchedNodes.length} selected cards)`;
  } else if (options.sectionId && board.sections[options.sectionId]) {
    const sec = board.sections[options.sectionId];
    matchedNodes = matchedNodes.filter((n) => n.sectionId === sec.id);
    scopeDescription = `Section Scope: ${sec.title} (${sec.slug})`;
  } else if (options.bbox) {
    const b = options.bbox;
    matchedNodes = matchedNodes.filter(
      (n) =>
        n.position.x + n.size.width >= b.x &&
        n.position.x <= b.x + b.width &&
        n.position.y + n.size.height >= b.y &&
        n.position.y <= b.y + b.height
    );
    scopeDescription = `Bounding Box Region (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)})`;
  }

  const nodeIds = new Set(matchedNodes.map((n) => n.id));

  if (options.includeConnected !== false) {
    for (const edge of Object.values(board.edges)) {
      if (nodeIds.has(edge.fromNodeId) && board.nodes[edge.toNodeId]) {
        nodeIds.add(edge.toNodeId);
      } else if (nodeIds.has(edge.toNodeId) && board.nodes[edge.fromNodeId]) {
        nodeIds.add(edge.fromNodeId);
      }
    }
    matchedNodes = Object.values(board.nodes).filter((n) => nodeIds.has(n.id));
  }

  const matchedEdges = Object.values(board.edges).filter(
    (e) => nodeIds.has(e.fromNodeId) || nodeIds.has(e.toNodeId)
  );

  const sectionIds = new Set(matchedNodes.map((n) => n.sectionId).filter(Boolean) as string[]);
  if (options.sectionId) sectionIds.add(options.sectionId);
  const matchedSections =
    sectionIds.size > 0
      ? Object.values(board.sections).filter((s) => sectionIds.has(s.id))
      : Object.values(board.sections);

  const rawText = JSON.stringify({ matchedSections, matchedNodes, matchedEdges });
  const tokenEstimate = Math.max(50, Math.ceil(rawText.length / 4));

  return {
    boardName: board.name,
    boardTitle: board.title,
    version: board.version,
    scopeDescription,
    tokenEstimate,
    sections: matchedSections,
    nodes: matchedNodes,
    edges: matchedEdges,
    activePrompts: board.prompts.filter((p) => p.status === 'pending' || p.status === 'processing'),
  };
}
