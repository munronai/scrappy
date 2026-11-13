import { BoundingBox, CollaboratorPresence, NodeType, PromptExecutionRoute } from '../core/types.js';

export type ActiveTool = 'select' | 'pan' | 'region';
export type DrawerTab = 'agy' | 'icm' | 'export';
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export interface CardColorOption {
  hex: string;
  name: string;
}

export const CARD_COLORS: CardColorOption[] = [
  { hex: '#fef08a', name: 'Yellow' },
  { hex: '#bbf7d0', name: 'Mint Green' },
  { hex: '#bfdbfe', name: 'Sky Blue' },
  { hex: '#e9d5ff', name: 'Lavender' },
  { hex: '#fbcfe8', name: 'Pink' },
  { hex: '#fed7aa', name: 'Peach' },
  { hex: '#fecaca', name: 'Coral Red' },
  { hex: '#99f6e4', name: 'Teal' },
];

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface DragNodeState {
  id: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export interface ResizeNodeState {
  id: string;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  origBounds: BoundingBox;
}

export interface DragSectionState {
  id: string;
  startX: number;
  startY: number;
  origBounds: BoundingBox;
  childSnapshots: Record<string, { x: number; y: number; width: number; height: number }>;
}

export interface ResizeSectionState {
  id: string;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  origBounds: BoundingBox;
  childSnapshots: Record<string, { x: number; y: number; width: number; height: number }>;
}

export interface ConnectingState {
  nodeId: string;
  x: number;
  y: number;
  currX: number;
  currY: number;
}

export interface RegionDragState {
  startX: number;
  startY: number;
  currX: number;
  currY: number;
}

export interface ContextDialogState {
  screenX: number;
  screenY: number;
  boardX: number;
  boardY: number;
  targetNodeId?: string;
  targetSectionId?: string;
}

export interface EditingEdgeState {
  id: string;
  label: string;
  style: 'solid' | 'dashed' | 'animated';
  screenX: number;
  screenY: number;
}

export interface BoardListing {
  name: string;
  title: string;
  updatedAt: string;
  nodeCount: number;
}

export interface UserIdentity {
  actorId: string;
  name: string;
  color: string;
  role: 'human' | 'agent';
}

export const USER_PALETTES = [
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Teal', hex: '#14b8a6' },
];
