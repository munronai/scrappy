import { z } from 'zod';
import type { GraphOp } from './types.js';

const PointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

const SizeSchema = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

const BoundingBoxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

export const NodeTypeSchema = z.enum([
  'sticky',
  'shape',
  'text',
  'checklist',
  'mermaid',
  'image',
  'svg_graphic',
  'table',
  'suggestion',
  'data_card',
]);

export const AutoLayoutKindSchema = z.enum([
  'none',
  'grid',
  'flowchart-lr',
  'flowchart-tb',
  'sections',
]);

export const EdgeStyleSchema = z.enum(['solid', 'dashed', 'animated']);

const ChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  checked: z.boolean(),
});

const TableDataSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  stylePreset: z.string().optional(),
  customStyleDescription: z.string().optional(),
  customCss: z.string().optional(),
  customCssString: z.string().optional(),
});

/**
 * Base content schema without defaults so `.partial()` in `update_node`
 * never overwrites omitted fields (like `body` or `title`).
 */
const NodeContentPatchSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  checklistItems: z.array(ChecklistItemSchema).optional(),
  mermaidCode: z.string().optional(),
  imageUrl: z.string().optional(),
  svgCode: z.string().optional(),
  tableData: TableDataSchema.optional(),
  structuredData: z.record(z.unknown()).optional(),
  sourceMeta: z
    .object({
      provider: z.string(),
      externalId: z.string().optional(),
      url: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

const CreateNodeContentSchema = NodeContentPatchSchema.extend({
  body: z.string().default(''),
});

const NodeStyleSchema = z.object({
  color: z.string(),
  shape: z.enum(['rect', 'pill', 'diamond']).optional(),
});

const NodeLockSchema = z.object({
  holderId: z.string(),
  holderType: z.enum(['human', 'agent']),
  expiresAt: z.number().finite(),
});

const SuggestionMetaSchema = z.object({
  promptId: z.string().optional(),
  rationale: z.string().optional(),
  proposedEdges: z
    .array(
      z.object({
        fromNodeId: z.string(),
        toNodeId: z.string(),
        label: z.string().optional(),
      })
    )
    .optional(),
});

export const GraphOpSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create_node'),
    node: z.object({
      id: z.string().optional(),
      type: NodeTypeSchema.optional(),
      sectionId: z.string().optional(),
      lockedToSection: z.boolean().optional(),
      position: PointSchema.optional(),
      size: SizeSchema.optional(),
      content: CreateNodeContentSchema,
      style: NodeStyleSchema.partial().optional(),
      suggestionMeta: SuggestionMetaSchema.optional(),
    }),
    relativeTo: z
      .object({
        nodeId: z.string(),
        direction: z.enum(['right', 'below', 'left', 'above']),
      })
      .optional(),
  }),
  z.object({
    op: z.literal('update_node'),
    id: z.string().min(1),
    patch: z.object({
      type: NodeTypeSchema.optional(),
      sectionId: z.string().optional(),
      lockedToSection: z.boolean().optional(),
      position: PointSchema.partial().optional(),
      size: SizeSchema.partial().optional(),
      content: NodeContentPatchSchema.partial().optional(),
      style: NodeStyleSchema.partial().optional(),
      lock: NodeLockSchema.optional(),
    }),
  }),
  z.object({
    op: z.literal('delete_node'),
    id: z.string().min(1),
  }),
  z.object({
    op: z.literal('accept_suggestion'),
    id: z.string().min(1),
  }),
  z.object({
    op: z.literal('create_edge'),
    edge: z.object({
      id: z.string().optional(),
      fromNodeId: z.string().min(1),
      toNodeId: z.string().min(1),
      label: z.string().optional(),
      style: EdgeStyleSchema.optional(),
      directed: z.boolean().optional(),
    }),
  }),
  z.object({
    op: z.literal('update_edge'),
    id: z.string().min(1),
    patch: z.object({
      label: z.string().optional(),
      style: EdgeStyleSchema.optional(),
      directed: z.boolean().optional(),
    }),
  }),
  z.object({
    op: z.literal('delete_edge'),
    id: z.string().min(1),
  }),
  z.object({
    op: z.literal('create_section'),
    section: z.object({
      id: z.string().optional(),
      slug: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      bounds: BoundingBoxSchema.optional(),
      color: z.string().optional(),
    }),
  }),
  z.object({
    op: z.literal('update_section'),
    id: z.string().min(1),
    patch: z.object({
      slug: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      bounds: BoundingBoxSchema.partial().optional(),
      color: z.string().optional(),
      icmContextPath: z.string().optional(),
    }),
  }),
  z.object({
    op: z.literal('delete_section'),
    id: z.string().min(1),
  }),
  z.object({
    op: z.literal('set_selection'),
    nodeIds: z.array(z.string()),
    sectionId: z.string().optional(),
    boundingBox: BoundingBoxSchema.optional(),
  }),
  z.object({
    op: z.literal('auto_layout'),
    layout: AutoLayoutKindSchema,
    targetSectionId: z.string().optional(),
    targetNodeIds: z.array(z.string()).optional(),
  }),
]);

export const GraphOpsBatchSchema = z.array(GraphOpSchema);

export const OpsBatchRequestSchema = z.object({
  operations: GraphOpsBatchSchema.default([]),
  actorId: z.string().min(1).default('human'),
  autoLayout: AutoLayoutKindSchema.default('none'),
});

/**
 * Validates an unknown operations array against `GraphOpsBatchSchema` and
 * returns either typed `GraphOp[]` or a formatted error summary with Zod issues.
 */
export function validateGraphOpsBatch(
  operations: unknown
):
  | { success: true; operations: GraphOp[] }
  | { success: false; error: string; issues: z.ZodIssue[] } {
  const parsed = GraphOpsBatchSchema.safeParse(operations);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.length ? first.path.join('.') : 'operations';
    return {
      success: false,
      error: `Invalid graph operation at "${path}": ${first?.message || 'Validation failed'}`,
      issues: parsed.error.issues,
    };
  }
  return { success: true, operations: parsed.data as GraphOp[] };
}
