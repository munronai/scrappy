import { AutoLayoutKind, BoardDocument, CanvasNode } from './types.js';

/**
 * Arranges nodes (and optionally sections) in-place according to the requested layout strategy.
 */
export function computeAutoLayout(
  board: BoardDocument,
  layout: AutoLayoutKind,
  targetSectionId?: string,
  targetNodeIds?: string[]
): void {
  if (layout === 'none') return;

  if (layout === 'sections') {
    const sections = Object.values(board.sections).sort((a, b) => a.slug.localeCompare(b.slug));
    let currentX = 80;
    for (const sec of sections) {
      const memberNodes = Object.values(board.nodes).filter((n) => n.sectionId === sec.id);
      const cols = memberNodes.length > 4 ? 3 : 2;
      const rows = Math.max(2, Math.ceil(memberNodes.length / cols));
      const width = Math.max(580, cols * 280 + 60);
      const height = Math.max(460, rows * 180 + 110);

      sec.bounds = { x: currentX, y: 100, width, height };
      memberNodes.forEach((node, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        node.position = {
          x: sec.bounds.x + 30 + c * 280,
          y: sec.bounds.y + 75 + r * 175,
        };
      });
      currentX += width + 60;
    }
    return;
  }

  const nodes = Object.values(board.nodes).filter((n) => {
    if (targetNodeIds && targetNodeIds.length > 0) return targetNodeIds.includes(n.id);
    if (targetSectionId) return n.sectionId === targetSectionId;
    return true;
  });

  if (nodes.length === 0) return;

  const anchorSec = targetSectionId ? board.sections[targetSectionId] : undefined;
  const startX = anchorSec ? anchorSec.bounds.x + 35 : 120;
  const startY = anchorSec ? anchorSec.bounds.y + 80 : 140;

  if (layout === 'grid') {
    const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length)));
    nodes.forEach((node, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      node.position = {
        x: startX + c * 290,
        y: startY + r * 185,
      };
    });
  } else if (layout === 'flowchart-lr' || layout === 'flowchart-tb') {
    const nodeSet = new Set(nodes.map((n) => n.id));
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => {
      inDegree.set(n.id, 0);
      adj.set(n.id, []);
    });

    Object.values(board.edges).forEach((e) => {
      if (nodeSet.has(e.fromNodeId) && nodeSet.has(e.toNodeId)) {
        adj.get(e.fromNodeId)!.push(e.toNodeId);
        inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) || 0) + 1);
      }
    });

    const levels = new Map<string, number>();
    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) {
        queue.push(id);
        levels.set(id, 0);
      }
    });

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currLevel = levels.get(curr) || 0;
      for (const next of adj.get(curr) || []) {
        levels.set(next, Math.max(levels.get(next) || 0, currLevel + 1));
        inDegree.set(next, (inDegree.get(next) || 1) - 1);
        if (inDegree.get(next) === 0) {
          queue.push(next);
        }
      }
    }

    const byLevel = new Map<number, CanvasNode[]>();
    nodes.forEach((n) => {
      const lvl = levels.get(n.id) ?? 0;
      if (!byLevel.has(lvl)) byLevel.set(lvl, []);
      byLevel.get(lvl)!.push(n);
    });

    for (const [lvl, lvlNodes] of byLevel.entries()) {
      lvlNodes.forEach((node, idx) => {
        if (layout === 'flowchart-lr') {
          node.position = {
            x: startX + lvl * 320,
            y: startY + idx * 185,
          };
        } else {
          node.position = {
            x: startX + idx * 290,
            y: startY + lvl * 195,
          };
        }
      });
    }
  }
}
