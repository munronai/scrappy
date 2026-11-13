import {
  AutoLayoutKind,
  BoardDocument,
  CanvasNode,
  GraphOp,
  SectionNode,
} from './types.js';
import {
  extractChecklistFromMarkdown,
  extractTableFromMarkdown,
  formatChecklistToMarkdown,
  formatTableToMarkdown,
} from './markdown.js';
import { slugify } from './security.js';
import { computeAutoLayout } from './layout.js';

/**
 * Finds the first SectionNode whose bounding box contains the given 2D point.
 */
export function findContainingSection(
  position: { x: number; y: number },
  sections: Record<string, SectionNode>
): SectionNode | undefined {
  for (const sec of Object.values(sections)) {
    const b = sec.bounds;
    if (
      position.x >= b.x &&
      position.x <= b.x + b.width &&
      position.y >= b.y &&
      position.y <= b.y + b.height
    ) {
      return sec;
    }
  }
  return undefined;
}

/**
 * Applies a batch of GraphOp mutations deterministically to a BoardDocument,
 * incrementing its version and optionally running auto-layout.
 */
export function applyOperations(
  board: BoardDocument,
  operations: GraphOp[],
  actorId = 'human',
  autoLayout: AutoLayoutKind = 'none'
): BoardDocument {
  const now = new Date().toISOString();
  const createdNodeIds: string[] = [];

  for (const op of operations) {
    switch (op.op) {
      case 'create_section': {
        const count = Object.keys(board.sections).length + 1;
        const slug = op.section.slug || slugify(op.section.title, count);
        const id = op.section.id || `sec-${slug.replace(/_/g, '-')}`;
        const existingBounds = Object.values(board.sections).map((s) => s.bounds);
        const maxX =
          existingBounds.length > 0
            ? Math.max(...existingBounds.map((b) => b.x + b.width)) + 60
            : 80;
        const bounds = op.section.bounds || {
          x: maxX,
          y: 100,
          width: 600,
          height: 500,
        };
        board.sections[id] = {
          id,
          slug,
          title: op.section.title,
          description: op.section.description || '',
          bounds,
          color: op.section.color || '#38bdf8',
          icmContextPath: `sections/${slug}/CONTEXT.md`,
        };
        break;
      }

      case 'update_section': {
        const existing = board.sections[op.id];
        if (existing) {
          const oldBounds = { ...existing.bounds };
          const newBounds = op.patch.bounds
            ? { ...existing.bounds, ...op.patch.bounds }
            : existing.bounds;

          board.sections[op.id] = {
            ...existing,
            ...op.patch,
            bounds: newBounds,
          };

          const hasExplicitChildUpdates = operations.some(
            (otherOp) =>
              otherOp.op === 'update_node' &&
              board.nodes[otherOp.id]?.sectionId === existing.id
          );

          if (!hasExplicitChildUpdates && op.patch.bounds) {
            const scaleX = oldBounds.width > 0 ? newBounds.width / oldBounds.width : 1;
            const scaleY = oldBounds.height > 0 ? newBounds.height / oldBounds.height : 1;

            for (const node of Object.values(board.nodes)) {
              if (node.sectionId === existing.id && node.lockedToSection !== false) {
                const relX = node.position.x - oldBounds.x;
                const relY = node.position.y - oldBounds.y;
                node.position = {
                  x: Math.round(newBounds.x + relX * scaleX),
                  y: Math.round(newBounds.y + relY * scaleY),
                };
                if (scaleX !== 1 || scaleY !== 1) {
                  node.size = {
                    width: Math.max(140, Math.round(node.size.width * scaleX)),
                    height: Math.max(90, Math.round(node.size.height * scaleY)),
                  };
                }
                node.updatedAt = now;
              }
            }
          }
        }
        break;
      }

      case 'delete_section': {
        delete board.sections[op.id];
        for (const node of Object.values(board.nodes)) {
          if (node.sectionId === op.id) {
            node.sectionId = undefined;
          }
        }
        break;
      }

      case 'create_node': {
        const id =
          op.node.id ||
          `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        let position = op.node.position;

        if (!position && op.relativeTo && board.nodes[op.relativeTo.nodeId]) {
          const ref = board.nodes[op.relativeTo.nodeId];
          const gap = 50;
          if (op.relativeTo.direction === 'right') {
            position = { x: ref.position.x + ref.size.width + gap, y: ref.position.y };
          } else if (op.relativeTo.direction === 'below') {
            position = { x: ref.position.x, y: ref.position.y + ref.size.height + gap };
          } else if (op.relativeTo.direction === 'left') {
            position = { x: Math.max(40, ref.position.x - 260 - gap), y: ref.position.y };
          } else {
            position = { x: ref.position.x, y: Math.max(40, ref.position.y - 160 - gap) };
          }
        }

        const sectionId =
          op.node.sectionId ||
          (position ? findContainingSection(position, board.sections)?.id : undefined);

        const targetSec = sectionId ? board.sections[sectionId] : undefined;
        if (!position) {
          if (targetSec) {
            const secNodes = Object.values(board.nodes).filter((n) => n.sectionId === targetSec.id);
            const col = secNodes.length % 2;
            const row = Math.floor(secNodes.length / 2);
            position = {
              x: targetSec.bounds.x + 30 + col * 280,
              y: targetSec.bounds.y + 75 + row * 175,
            };
          } else {
            const count = Object.keys(board.nodes).length;
            position = {
              x: 120 + (count % 4) * 290,
              y: 140 + Math.floor(count / 4) * 185,
            };
          }
        }

        const secSlug = targetSec ? targetSec.slug : '00_scratchpad';
        const resolvedChecklist =
          op.node.content.checklistItems ||
          (op.node.type === 'checklist'
            ? extractChecklistFromMarkdown(op.node.content.body || '') || [
                { id: 'item-1', text: 'First task / bug item', checked: false },
              ]
            : extractChecklistFromMarkdown(op.node.content.body || ''));

        const resolvedTable =
          op.node.content.tableData ||
          (op.node.type === 'table'
            ? extractTableFromMarkdown(op.node.content.body || '')
            : undefined);

        const resolvedType =
          op.node.type ||
          (resolvedChecklist ? 'checklist' : resolvedTable ? 'table' : 'sticky');

        const syncedBody =
          resolvedType === 'checklist' && resolvedChecklist
            ? formatChecklistToMarkdown(resolvedChecklist)
            : resolvedType === 'table' &&
              resolvedTable &&
              (!op.node.content.body || !op.node.content.body.includes('|'))
            ? formatTableToMarkdown(resolvedTable)
            : op.node.content.body || '';

        const node: CanvasNode = {
          id,
          type: resolvedType,
          sectionId,
          lockedToSection: op.node.lockedToSection ?? Boolean(sectionId),
          position,
          size:
            op.node.size ||
            (resolvedType === 'mermaid' || resolvedType === 'svg_graphic'
              ? { width: 340, height: 230 }
              : resolvedType === 'checklist'
              ? { width: 280, height: 210 }
              : resolvedType === 'table'
              ? { width: 440, height: 280 }
              : { width: 250, height: 150 }),
          content: {
            title: op.node.content.title || 'Untitled Note',
            body: syncedBody,
            tags: op.node.content.tags || [],
            checklistItems: resolvedChecklist,
            mermaidCode: op.node.content.mermaidCode,
            imageUrl: op.node.content.imageUrl,
            svgCode: op.node.content.svgCode,
            tableData: resolvedTable,
            structuredData: op.node.content.structuredData,
            sourceMeta: op.node.content.sourceMeta,
          },
          style: {
            color: op.node.style?.color || '#fef08a',
            shape: op.node.style?.shape || 'rect',
          },
          suggestionMeta: op.node.suggestionMeta,
          icmFilePath: `sections/${secSlug}/nodes/${id}.md`,
          updatedBy: actorId,
          updatedAt: now,
        };

        board.nodes[id] = node;
        createdNodeIds.push(id);
        break;
      }

      case 'update_node': {
        const existing = board.nodes[op.id];
        if (!existing) break;

        const nextPos = op.patch.position
          ? { ...existing.position, ...op.patch.position }
          : existing.position;
        const explicitSectionId =
          'sectionId' in op.patch
            ? op.patch.sectionId
            : findContainingSection(nextPos, board.sections)?.id ?? existing.sectionId;
        const secSlug =
          explicitSectionId && board.sections[explicitSectionId]
            ? board.sections[explicitSectionId].slug
            : '00_scratchpad';

        const nextLockedToSection =
          'lockedToSection' in op.patch
            ? op.patch.lockedToSection
            : explicitSectionId
            ? existing.lockedToSection ?? true
            : false;

        const mergedContent = op.patch.content
          ? { ...existing.content, ...op.patch.content }
          : { ...existing.content };

        if (mergedContent.checklistItems && (op.patch.type || existing.type) === 'checklist') {
          mergedContent.body = formatChecklistToMarkdown(mergedContent.checklistItems);
        }
        if (
          mergedContent.tableData &&
          (op.patch.type || existing.type) === 'table' &&
          !op.patch.content?.body
        ) {
          mergedContent.body = formatTableToMarkdown(mergedContent.tableData);
        }

        board.nodes[op.id] = {
          ...existing,
          ...op.patch,
          sectionId: explicitSectionId,
          lockedToSection: nextLockedToSection,
          position: nextPos,
          size: op.patch.size ? { ...existing.size, ...op.patch.size } : existing.size,
          content: mergedContent,
          style: op.patch.style ? { ...existing.style, ...op.patch.style } : existing.style,
          icmFilePath: `sections/${secSlug}/nodes/${existing.id}.md`,
          updatedBy: actorId,
          updatedAt: now,
        };
        break;
      }

      case 'accept_suggestion': {
        const node = board.nodes[op.id];
        if (node && node.type === 'suggestion') {
          node.type = 'sticky';
          node.style.color = '#bbf7d0';
          node.updatedBy = actorId;
          node.updatedAt = now;
          if (node.suggestionMeta?.proposedEdges) {
            for (const pe of node.suggestionMeta.proposedEdges) {
              const edgeId = `edge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
              board.edges[edgeId] = {
                id: edgeId,
                fromNodeId: pe.fromNodeId,
                toNodeId: pe.toNodeId,
                label: pe.label,
                style: 'solid',
                directed: true,
              };
            }
          }
          node.suggestionMeta = undefined;
        }
        break;
      }

      case 'delete_node': {
        delete board.nodes[op.id];
        for (const [edgeId, edge] of Object.entries(board.edges)) {
          if (edge.fromNodeId === op.id || edge.toNodeId === op.id) {
            delete board.edges[edgeId];
          }
        }
        board.activeSelection.nodeIds = board.activeSelection.nodeIds.filter((id) => id !== op.id);
        break;
      }

      case 'create_edge': {
        if (!board.nodes[op.edge.fromNodeId] || !board.nodes[op.edge.toNodeId]) break;
        const id = op.edge.id || `edge-${op.edge.fromNodeId}-${op.edge.toNodeId}`;
        board.edges[id] = {
          id,
          fromNodeId: op.edge.fromNodeId,
          toNodeId: op.edge.toNodeId,
          label: op.edge.label,
          style: op.edge.style || 'solid',
          directed: op.edge.directed ?? true,
        };
        break;
      }

      case 'update_edge': {
        const existingEdge = board.edges[op.id];
        if (existingEdge) {
          board.edges[op.id] = {
            ...existingEdge,
            ...op.patch,
          };
        }
        break;
      }

      case 'delete_edge': {
        delete board.edges[op.id];
        break;
      }

      case 'set_selection': {
        board.activeSelection = {
          nodeIds: op.nodeIds,
          sectionId: op.sectionId,
          boundingBox: op.boundingBox,
          updatedAt: now,
        };
        break;
      }

      case 'auto_layout': {
        computeAutoLayout(board, op.layout, op.targetSectionId, op.targetNodeIds);
        break;
      }
    }
  }

  if (autoLayout !== 'none') {
    computeAutoLayout(
      board,
      autoLayout,
      undefined,
      createdNodeIds.length > 0 ? createdNodeIds : undefined
    );
  }

  board.version += 1;
  board.updatedAt = now;
  return board;
}
