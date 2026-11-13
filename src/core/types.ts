export type NodeType =
  | 'sticky'
  | 'shape'
  | 'text'
  | 'data_card'
  | 'suggestion'
  | 'checklist'
  | 'mermaid'
  | 'image'
  | 'svg_graphic'
  | 'table';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface TableData {
  columns: string[];
  rows: string[][];
  stylePreset?: 'default' | 'zebra' | 'sky' | 'emerald' | 'amber' | 'minimal' | 'purple' | string;
  customStyleDescription?: string;
  customCss?: string;
}

export type ShapeKind = 'rect' | 'pill' | 'diamond';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SectionNode {
  id: string;
  slug: string; // e.g., "01_discovery"
  title: string;
  description?: string;
  bounds: BoundingBox;
  color: string;
  icmContextPath?: string; // e.g., "sections/01_discovery/CONTEXT.md"
}

export interface CanvasNode {
  id: string;
  type: NodeType;
  sectionId?: string;
  lockedToSection?: boolean; // If true (default when in a section), moves & resizes with parent section
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: {
    title?: string;
    body: string; // Markdown text
    tags?: string[];
    checklistItems?: ChecklistItem[]; // For interactive checklist widget
    mermaidCode?: string; // For in-place Mermaid diagram shape
    imageUrl?: string; // For pasted / uploaded image card
    svgCode?: string; // For artistic SVG graphic interpretations
    tableData?: TableData; // For interactive & styled table widget
    structuredData?: Record<string, unknown>; // For webhook/MCP integrations
    sourceMeta?: {
      provider: string;
      externalId?: string;
      url?: string;
      status?: string;
    };
  };
  style: {
    color: string;
    shape?: ShapeKind;
  };
  suggestionMeta?: {
    promptId?: string;
    rationale?: string;
    proposedEdges?: Array<{ fromNodeId: string; toNodeId: string; label?: string }>;
  };
  lock?: {
    holderId: string;
    holderType: 'human' | 'agent';
    expiresAt: number;
  };
  icmFilePath?: string; // e.g., "sections/01_discovery/nodes/node-1.md"
  updatedBy: string;
  updatedAt: string;
}

export interface CanvasEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'animated';
  directed: boolean;
}

export interface PinAnchor {
  id: string;
  label: string;
  position: { x: number; y: number };
  targetSectionId?: string;
  targetNodeId?: string;
}

export interface RegisteredICMPipeline {
  id: string; // e.g., "brand-image-gen"
  title: string; // e.g., "Brand-Aligned Image & Graphic Pipeline"
  description: string;
  routingPath: string; // e.g., "pipelines/brand-image-gen/CONTEXT.md"
  triggerIntents: string[]; // e.g., ["image", "graphic", "illustration", "hero", "visual"]
  configRefs: string[]; // e.g., ["_config/brand-guidelines.md", "_config/visual-style.md"]
  stages: string[]; // e.g., ["01-prompt-spec", "02-brand-style-check", "03-render"]
  outputWidgetType: NodeType;
  walkTestPassed: boolean;
}

export interface ICMWalkTestResult {
  passed: boolean;
  checkedAt: string;
  rootRoutingFile: string;
  form: 'pipeline' | 'umbrella' | 'record-library' | 'knowledge-bundle' | 'context-map';
  stagesChecked: number;
  brokenReferences: string[];
  summary: string;
}

export interface ICMWorkspaceMeta {
  rootRoutingFile: string; // e.g., "boards/launch-plan/CONTEXT.md"
  form: 'pipeline' | 'umbrella' | 'record-library' | 'knowledge-bundle' | 'context-map';
  configFiles: string[]; // e.g., ["_config/brand-guidelines.md", "_config/visual-style.md"]
  pipelines: RegisteredICMPipeline[];
  lastWalkTest?: ICMWalkTestResult;
}

export type PromptExecutionRoute = 'pipeline' | 'adhoc' | 'scaffold_pipeline';

export interface PromptRequest {
  id: string;
  boardName?: string;
  prompt: string;
  mode?: 'icm' | 'standalone_api';
  executionRoute?: PromptExecutionRoute;
  selectedPipelineId?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  anchorPosition?: { x: number; y: number };
  targetNodeId?: string;
  selectedNodeIds: string[];
  selectedSectionId?: string;
  boundingBox?: BoundingBox;
  tokenEstimate?: number;
  createdAt: string;
  completedAt?: string;
  agentResponseSummary?: string;
}

export interface CollaboratorPresence {
  actorId: string;
  name: string;
  role: 'human' | 'agent';
  color: string;
  cursor: { x: number; y: number };
  viewport?: { x: number; y: number; zoom: number };
  activeNodeId?: string;
  statusText?: string;
  updatedAt: number;
}

export interface BoardDocument {
  id: string;
  name: string;
  title: string;
  version: number;
  security: {
    mode: 'public' | 'passcode' | 'group';
    passcodeHash?: string;
    allowedGroups?: string[];
  };
  sections: Record<string, SectionNode>;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  pins: Record<string, PinAnchor>;
  activeSelection: {
    nodeIds: string[];
    sectionId?: string;
    boundingBox?: BoundingBox;
    updatedAt?: string;
  };
  prompts: PromptRequest[];
  icmWorkspace?: ICMWorkspaceMeta;
  updatedAt: string;
}

export type AutoLayoutKind =
  | 'none'
  | 'grid'
  | 'flowchart-lr'
  | 'flowchart-tb'
  | 'sections';

export type GraphOp =
  | {
      op: 'create_node';
      node: Partial<CanvasNode> & { id?: string; content: { title?: string; body: string } };
      relativeTo?: { nodeId: string; direction: 'right' | 'below' | 'left' | 'above' };
    }
  | {
      op: 'update_node';
      id: string;
      patch: Partial<
        Pick<CanvasNode, 'position' | 'size' | 'sectionId' | 'lockedToSection' | 'type' | 'lock'>
      > & {
        content?: Partial<CanvasNode['content']>;
        style?: Partial<CanvasNode['style']>;
      };
    }
  | {
      op: 'delete_node';
      id: string;
    }
  | {
      op: 'accept_suggestion';
      id: string;
    }
  | {
      op: 'create_edge';
      edge: Partial<CanvasEdge> & { fromNodeId: string; toNodeId: string };
    }
  | {
      op: 'update_edge';
      id: string;
      patch: Partial<Pick<CanvasEdge, 'label' | 'style' | 'directed'>>;
    }
  | {
      op: 'delete_edge';
      id: string;
    }
  | {
      op: 'create_section';
      section: Partial<SectionNode> & { title: string; slug?: string };
    }
  | {
      op: 'update_section';
      id: string;
      patch: Partial<SectionNode>;
    }
  | {
      op: 'delete_section';
      id: string;
    }
  | {
      op: 'set_selection';
      nodeIds: string[];
      sectionId?: string;
      boundingBox?: BoundingBox;
    }
  | {
      op: 'auto_layout';
      layout: AutoLayoutKind;
      targetSectionId?: string;
      targetNodeIds?: string[];
    };

export interface SpatialContextSlice {
  boardName: string;
  boardTitle: string;
  version: number;
  scopeDescription: string;
  tokenEstimate: number;
  sections: SectionNode[];
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  activePrompts: PromptRequest[];
}

export type BoardTemplateKind = 'clean' | 'default' | 'pipeline' | 'retrospective';

