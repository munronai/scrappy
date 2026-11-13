import React from 'react';
import { BoardDocument, CanvasEdge } from '../../../core/index.js';
import { ConnectingState } from '../../types.js';
import { computeConnectorBezier } from '../../utils/geometry.js';

interface EdgeLayerProps {
  board: BoardDocument;
  editingEdgeId?: string;
  connectingFrom: ConnectingState | null;
  defaultEdgeStyle: 'solid' | 'dashed' | 'animated';
  onOpenEdgeInspector: (edge: CanvasEdge, e: React.MouseEvent) => void;
}

/**
 * Renders SVG directed edges and connector lines between nodes.
 * Supports smooth cubic Bezier paths, arrowheads, animated flow indicators,
 * clickable hit-areas, and label badges.
 */
export function EdgeLayer({
  board,
  editingEdgeId,
  connectingFrom,
  defaultEdgeStyle,
  onOpenEdgeInspector,
}: EdgeLayerProps) {
  return (
    <svg
      width={4000}
      height={3000}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto"
        >
          <polygon points="0 0, 10 4, 0 8" fill="#94a3b8" />
        </marker>
        <marker
          id="arrowhead-active"
          markerWidth="10"
          markerHeight="8"
          refX="9"
          refY="4"
          orient="auto"
        >
          <polygon points="0 0, 10 4, 0 8" fill="#38bdf8" />
        </marker>
      </defs>

      {Object.values(board.edges).map((edge: CanvasEdge) => {
        const from = board.nodes[edge.fromNodeId];
        const to = board.nodes[edge.toNodeId];
        if (!from || !to) return null;

        const x1 = from.position.x + from.size.width;
        const y1 = from.position.y + from.size.height / 2;
        const x2 = to.position.x;
        const y2 = to.position.y + to.size.height / 2;

        const { pathD, midX, midY } = computeConnectorBezier(x1, y1, x2, y2);
        const isAnimated = edge.style === 'animated';
        const isDashed = edge.style === 'dashed';
        const isSelectedEdge = editingEdgeId === edge.id;

        return (
          <g key={edge.id} style={{ pointerEvents: 'auto' }}>
            {/* Wide invisible click hit-area so clicking anywhere on a line is effortless */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ cursor: 'pointer' }}
              onClick={(e) => onOpenEdgeInspector(edge, e)}
            />
            {/* Visible connector path */}
            <path
              d={pathD}
              fill="none"
              stroke={
                isSelectedEdge
                  ? '#f59e0b'
                  : isAnimated
                  ? '#38bdf8'
                  : '#94a3b8'
              }
              strokeWidth={isSelectedEdge ? 3.5 : 2.5}
              strokeDasharray={isDashed ? '7 5' : undefined}
              className={isAnimated ? 'edge-animated' : undefined}
              markerEnd={isAnimated ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
              style={{ cursor: 'pointer' }}
              onClick={(e) => onOpenEdgeInspector(edge, e)}
            />
            {/* Connector Label Badge (clickable to edit label & connector style) */}
            <g
              transform={`translate(${midX}, ${midY})`}
              onClick={(e) => onOpenEdgeInspector(edge, e)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={edge.label ? -Math.max(44, edge.label.length * 3.8) : -28}
                y={-12}
                width={edge.label ? Math.max(88, edge.label.length * 7.6) : 56}
                height={22}
                rx={6}
                fill={isSelectedEdge ? '#f59e0b' : '#1e293b'}
                stroke={isSelectedEdge ? '#fde68a' : isAnimated ? '#38bdf8' : '#475569'}
              />
              <text
                x={0}
                y={3}
                textAnchor="middle"
                fill={isSelectedEdge ? '#0f172a' : '#e2e8f0'}
                fontSize={11}
                fontWeight={600}
              >
                {edge.label || '✎ label'}
              </text>
            </g>
          </g>
        );
      })}

      {/* Live connector line while dragging */}
      {connectingFrom && (
        <line
          x1={connectingFrom.x}
          y1={connectingFrom.y}
          x2={connectingFrom.currX}
          y2={connectingFrom.currY}
          stroke={defaultEdgeStyle === 'animated' ? '#38bdf8' : '#94a3b8'}
          strokeWidth={2.5}
          strokeDasharray={defaultEdgeStyle === 'solid' ? undefined : '5 5'}
          markerEnd={
            defaultEdgeStyle === 'animated'
              ? 'url(#arrowhead-active)'
              : 'url(#arrowhead)'
          }
        />
      )}
    </svg>
  );
}
