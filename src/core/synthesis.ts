import { BoardDocument } from './types.js';
import { extractSpatialSlice } from './slicing.js';

/**
 * Compiles a board or scoped section into a structured Markdown document.
 */
export function synthesizeBoardToMarkdown(board: BoardDocument, sectionId?: string): string {
  const slice = extractSpatialSlice(board, { sectionId, includeConnected: false });
  const lines: string[] = [];

  lines.push(`# ${board.title}`);
  lines.push(
    `> Synthesized from Scrappy Whiteboard (\`${board.name}\`, v${board.version}) — ${new Date().toISOString()}`
  );
  lines.push('');

  const sections = [...slice.sections].sort((a, b) => a.slug.localeCompare(b.slug));
  for (const sec of sections) {
    lines.push(`## ${sec.title}`);
    if (sec.description) {
      lines.push(`*${sec.description}*`);
      lines.push('');
    }
    const secNodes = slice.nodes.filter((n) => n.sectionId === sec.id);
    if (secNodes.length === 0) {
      lines.push(`- *(No items in this section)*`);
    } else {
      for (const n of secNodes) {
        const prefix = n.type === 'suggestion' ? '💡 **[AI Suggestion]** ' : '';
        lines.push(`### ${prefix}${n.content.title || n.id}`);
        if (n.content.body) {
          lines.push(n.content.body);
        }
        if (n.content.structuredData) {
          lines.push('```json');
          lines.push(JSON.stringify(n.content.structuredData, null, 2));
          lines.push('```');
        }
        const outEdges = slice.edges.filter((e) => e.fromNodeId === n.id);
        if (outEdges.length > 0) {
          const targets = outEdges
            .map((e) => {
              const targetTitle = board.nodes[e.toNodeId]?.content.title || e.toNodeId;
              return e.label ? `**${e.label}** -> *${targetTitle}*` : `-> *${targetTitle}*`;
            })
            .join(', ');
          lines.push(`- **Connections:** ${targets}`);
        }
        lines.push('');
      }
    }
  }

  const unassigned = slice.nodes.filter((n) => !n.sectionId);
  if (unassigned.length > 0) {
    lines.push(`## Unassigned / Scratchpad Notes`);
    for (const n of unassigned) {
      lines.push(`- **${n.content.title || n.id}**: ${n.content.body}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Compiles a board or scoped section into a Mermaid `flowchart LR` diagram.
 */
export function synthesizeBoardToMermaid(board: BoardDocument, sectionId?: string): string {
  const slice = extractSpatialSlice(board, { sectionId });
  const lines: string[] = ['flowchart LR'];

  for (const sec of slice.sections) {
    const secNodes = slice.nodes.filter((n) => n.sectionId === sec.id);
    if (secNodes.length > 0) {
      lines.push(`  subgraph ${sec.slug}["${sec.title.replace(/"/g, "'")}"]`);
      for (const n of secNodes) {
        const safeLabel = (n.content.title || n.id).replace(/"/g, "'");
        lines.push(`    ${n.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${safeLabel}"]`);
      }
      lines.push('  end');
    }
  }

  for (const n of slice.nodes.filter((node) => !node.sectionId)) {
    const safeLabel = (n.content.title || n.id).replace(/"/g, "'");
    lines.push(`  ${n.id.replace(/[^a-zA-Z0-9_]/g, '_')}["${safeLabel}"]`);
  }

  for (const e of slice.edges) {
    const fromId = e.fromNodeId.replace(/[^a-zA-Z0-9_]/g, '_');
    const toId = e.toNodeId.replace(/[^a-zA-Z0-9_]/g, '_');
    if (e.label) {
      lines.push(`  ${fromId} -->|"${e.label.replace(/"/g, "'")}"| ${toId}`);
    } else {
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  return lines.join('\n');
}
