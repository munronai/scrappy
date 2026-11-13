import React, { useState } from 'react';
import {
  BoardDocument,
  CanvasNode,
  ChecklistItem,
  GraphOp,
  TableData,
} from '../../../core/index.js';
import { CARD_COLORS, ConnectingState, ResizeCorner } from '../../types.js';
import { miniActionBtnStyle } from '../../styles.js';
import { CornerHandles } from './CornerHandles.js';
import {
  ChecklistWidget,
  ImageWidget,
  MermaidWidget,
  SvgGraphicWidget,
  TableWidget,
} from '../../widgets/WidgetLibrary.js';

interface NodeLayerProps {
  board: BoardDocument;
  showCardBorders: boolean;
  showResizeHandles: boolean;
  showNodeMetadata: boolean;
  defaultEdgeStyle: 'solid' | 'dashed' | 'animated';
  isPanning: boolean;
  connectingFrom: ConnectingState | null;
  onStartDragNode: (id: string, e: React.MouseEvent) => void;
  onStartResizeNode: (id: string, corner: ResizeCorner, e: React.MouseEvent) => void;
  onStartConnecting: (nodeId: string, x: number, y: number) => void;
  onCompleteConnecting: (toNodeId: string) => void;
  onOpenScrappyContextMenu: (
    e: React.MouseEvent,
    targetNodeId?: string,
    explicitSectionId?: string
  ) => void;
  onOpenEditModal: (node: CanvasNode) => void;
  onInspectJson: (nodeId: string) => void;
  inspectingJsonNodeId: string | null;
  onOpenIcmFile: (filePath: string) => void;
  sendOps: (ops: GraphOp[]) => Promise<void>;
  onSubmitScrappyPrompt: (
    prompt: string,
    anchor?: {
      boardX: number;
      boardY: number;
      targetNodeId?: string;
      targetSectionId?: string;
    }
  ) => void;
}

/**
 * Renders all interactive cards and UI widgets on the canvas.
 * Manages per-node hover toolbars, color palettes, double-click edits,
 * drag handles, and delegates to WidgetLibrary (Checklist, Mermaid, Table, Image, SvgGraphic).
 */
export function NodeLayer({
  board,
  showCardBorders,
  showResizeHandles,
  showNodeMetadata,
  defaultEdgeStyle,
  isPanning,
  connectingFrom,
  onStartDragNode,
  onStartResizeNode,
  onStartConnecting,
  onCompleteConnecting,
  onOpenScrappyContextMenu,
  onOpenEditModal,
  onInspectJson,
  inspectingJsonNodeId,
  onOpenIcmFile,
  sendOps,
  onSubmitScrappyPrompt,
}: NodeLayerProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [colorPickerNodeId, setColorPickerNodeId] = useState<string | null>(null);

  return (
    <>
      {Object.values(board.nodes).map((node: CanvasNode) => {
        const isSelected = board.activeSelection.nodeIds.includes(node.id);
        const isHoveredNode = hoveredNodeId === node.id;
        const isSuggestion = node.type === 'suggestion';
        const isDataCard = node.type === 'data_card';
        const isTextNode = node.type === 'text';
        const isDarkCard =
          isSuggestion ||
          isDataCard ||
          node.type === 'mermaid' ||
          node.type === 'image' ||
          node.type === 'svg_graphic' ||
          node.type === 'table';
        const isLockedToScope = Boolean(node.sectionId && node.lockedToSection !== false);
        const showColorPicker = colorPickerNodeId === node.id;

        return (
          <div
            key={node.id}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => {
              setHoveredNodeId((curr) => (curr === node.id ? null : curr));
              setColorPickerNodeId((curr) => (curr === node.id ? null : curr));
            }}
            onContextMenu={(e) => onOpenScrappyContextMenu(e, node.id, node.sectionId)}
            onMouseDown={(e) => {
              if (e.button === 2) return;
              e.stopPropagation();
              setColorPickerNodeId(null);
              if (e.shiftKey) {
                const nextSel = isSelected
                  ? board.activeSelection.nodeIds.filter((id: string) => id !== node.id)
                  : [...board.activeSelection.nodeIds, node.id];
                sendOps([{ op: 'set_selection', nodeIds: nextSel }]);
                return;
              }
              onStartDragNode(node.id, e);
            }}
            onMouseUp={(e) => {
              if (connectingFrom && connectingFrom.nodeId !== node.id) {
                e.stopPropagation();
                onCompleteConnecting(node.id);
              }
            }}
            onDoubleClick={(e) => {
              if (
                node.type === 'mermaid' ||
                node.type === 'checklist' ||
                node.type === 'table'
              ) {
                return;
              }
              e.stopPropagation();
              onOpenEditModal(node);
            }}
            style={{
              position: 'absolute',
              left: node.position.x,
              top: node.position.y,
              width: node.size.width,
              height: node.size.height,
              background: isTextNode
                ? isSelected
                  ? 'rgba(56, 189, 248, 0.08)'
                  : 'transparent'
                : isSuggestion
                ? 'rgba(30, 41, 59, 0.92)'
                : isDarkCard
                ? '#0f172a'
                : node.style.color,
              color: isTextNode
                ? node.style.color || '#f8fafc'
                : isDarkCard
                ? '#f8fafc'
                : '#0f172a',
              borderRadius: isTextNode ? 6 : node.style.shape === 'pill' ? 32 : 14,
              border: isTextNode
                ? isSelected
                  ? '1.5px dashed #38bdf8'
                  : isHoveredNode
                  ? '1px dashed rgba(255, 255, 255, 0.3)'
                  : 'none'
                : isSelected
                ? '2.5px solid #38bdf8'
                : showCardBorders
                ? isSuggestion
                  ? '2px dashed #f59e0b'
                  : isDataCard
                  ? '2px solid #10b981'
                  : node.type === 'mermaid'
                  ? '2px solid #38bdf8'
                  : node.type === 'svg_graphic'
                  ? '2px solid #a855f7'
                  : node.type === 'table'
                  ? '2px solid rgba(56, 189, 248, 0.4)'
                  : '1px solid rgba(15,23,42,0.22)'
                : isHoveredNode
                ? '1.5px solid rgba(255, 255, 255, 0.2)'
                : 'none',
              padding: isTextNode ? '6px 8px' : '11px 13px',
              boxShadow: isTextNode
                ? 'none'
                : isSelected
                ? '0 0 0 4px rgba(56, 189, 248, 0.25), 0 12px 28px rgba(0,0,0,0.4)'
                : isHoveredNode
                ? '0 8px 24px rgba(0,0,0,0.3)'
                : '0 3px 12px rgba(0,0,0,0.16)',
              pointerEvents: 'auto',
              cursor: isPanning ? 'grabbing' : isTextNode ? 'text' : 'grab',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: isTextNode ? 'center' : 'space-between',
            }}
          >
            {/* 4 Corner Resize Handles */}
            <CornerHandles
              onStartCornerResize={(corner, e) => onStartResizeNode(node.id, corner, e)}
              accentColor={
                isSuggestion ? '#f59e0b' : isDarkCard ? '#38bdf8' : '#334155'
              }
              size={14}
              showResizeHandles={showResizeHandles}
            />

            {/* Floating Action Toolbar & Colour Swatch Bar */}
            {(isHoveredNode || showColorPicker) && (
              <div
                style={{
                  position: 'absolute',
                  top: -48,
                  left: -10,
                  right: -10,
                  height: 50,
                  pointerEvents: 'auto',
                  zIndex: 60,
                }}
              >
                {isHoveredNode && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(15, 23, 42, 0.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      borderRadius: 8,
                      padding: '3px 6px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      pointerEvents: 'auto',
                    }}
                  >
                    {(node.type === 'sticky' ||
                      node.type === 'shape' ||
                      node.type === 'checklist' ||
                      node.type === 'table' ||
                      node.type === 'text') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setColorPickerNodeId(showColorPicker ? null : node.id);
                        }}
                        style={miniActionBtnStyle}
                        title="Change card colour"
                      >
                        🎨
                      </button>
                    )}

                    {node.sectionId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          sendOps([
                            {
                              op: 'update_node',
                              id: node.id,
                              patch: { lockedToSection: !isLockedToScope },
                            },
                          ]);
                          setHoveredNodeId(null);
                        }}
                        style={{
                          ...miniActionBtnStyle,
                          color: isLockedToScope ? '#38bdf8' : '#fda4af',
                        }}
                        title={
                          isLockedToScope
                            ? 'Locked to Scope Section. Click to unlock.'
                            : 'Unlocked from Scope Section. Click to lock.'
                        }
                      >
                        {isLockedToScope ? '🔒' : '🔓'}
                      </button>
                    )}

                    {isDataCard && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectJson(node.id);
                          setHoveredNodeId(null);
                        }}
                        style={{ ...miniActionBtnStyle, color: '#38bdf8', fontSize: 10 }}
                        title="Inspect Raw JSON"
                      >
                        {'{ }'}
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendOps([{ op: 'delete_node', id: node.id }]);
                        setHoveredNodeId(null);
                      }}
                      style={{ ...miniActionBtnStyle, color: '#f87171' }}
                      title="Delete card"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Floating Colour Swatch Bar */}
                {showColorPicker && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 10,
                      background: '#0f172a',
                      border: '1px solid rgba(148,163,184,0.35)',
                      borderRadius: 999,
                      padding: '5px 8px',
                      display: 'flex',
                      gap: 6,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                      pointerEvents: 'auto',
                    }}
                  >
                    {CARD_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={(e) => {
                          e.stopPropagation();
                          sendOps([
                            {
                              op: 'update_node',
                              id: node.id,
                              patch: { style: { color: c.hex } },
                            },
                          ]);
                          setColorPickerNodeId(null);
                          setHoveredNodeId(null);
                        }}
                        title={c.name}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: c.hex,
                          border:
                            node.style.color === c.hex
                              ? '2px solid #38bdf8'
                              : '1px solid rgba(15,23,42,0.4)',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Card Content Body */}
            <div
              style={{
                overflow: 'hidden',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Optional Metadata Row */}
              {showNodeMetadata && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 5,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: isSuggestion
                        ? 'rgba(245, 158, 11, 0.2)'
                        : isDarkCard
                        ? 'rgba(56, 189, 248, 0.16)'
                        : 'rgba(15, 23, 42, 0.1)',
                      color: isSuggestion
                        ? '#fbbf24'
                        : isDarkCard
                        ? '#38bdf8'
                        : '#334155',
                    }}
                  >
                    {isSuggestion
                      ? '✨ AI Gap Suggestion'
                      : isDataCard
                      ? `🔌 ${node.content.sourceMeta?.provider || 'Integration'}`
                      : node.type === 'checklist'
                      ? '☑️ Checklist'
                      : node.type === 'mermaid'
                      ? '📊 Mermaid Diagram'
                      : node.type === 'svg_graphic'
                      ? '🎨 Graphic'
                      : node.type === 'image'
                      ? '🖼️ Image'
                      : node.type === 'table'
                      ? '📋 Table'
                      : node.type}
                  </span>
                  {node.icmFilePath && (
                    <span
                      style={{
                        fontSize: 9.5,
                        color: '#64748b',
                        fontFamily: 'monospace',
                      }}
                    >
                      {node.icmFilePath}
                    </span>
                  )}
                </div>
              )}

              {/* Card Title */}
              {!isTextNode && Boolean(node.content.title) && (
                <div
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenEditModal(node);
                  }}
                  style={{
                    fontWeight: 700,
                    fontSize: 13.5,
                    marginBottom: 4,
                    lineHeight: 1.25,
                  }}
                >
                  {node.content.title}
                </div>
              )}

              {/* Specialized UI Library Widget Renderers */}
              {node.type === 'checklist' ? (
                <ChecklistWidget
                  node={node}
                  onUpdateItems={(nextItems: ChecklistItem[]) => {
                    sendOps([
                      {
                        op: 'update_node',
                        id: node.id,
                        patch: {
                          content: { checklistItems: nextItems },
                        },
                      },
                    ]);
                  }}
                  onActionOpenItems={() => {
                    onSubmitScrappyPrompt(
                      `@scrappy action the open unchecked bugs in "${node.content.title}"`,
                      {
                        boardX: node.position.x + node.size.width + 60,
                        boardY: node.position.y,
                        targetNodeId: node.id,
                        targetSectionId: node.sectionId,
                      }
                    );
                  }}
                />
              ) : node.type === 'mermaid' ? (
                <MermaidWidget
                  node={node}
                  onSaveMermaid={(nextCode: string) => {
                    sendOps([
                      {
                        op: 'update_node',
                        id: node.id,
                        patch: {
                          content: {
                            mermaidCode: nextCode,
                            body: '```mermaid\n' + nextCode + '\n```',
                          },
                        },
                      },
                    ]);
                  }}
                />
              ) : node.type === 'image' ? (
                <ImageWidget
                  node={node}
                  onUpdateImage={(nextUrl: string) => {
                    sendOps([
                      {
                        op: 'update_node',
                        id: node.id,
                        patch: {
                          content: { imageUrl: nextUrl },
                        },
                      },
                    ]);
                  }}
                />
              ) : node.type === 'svg_graphic' ? (
                <SvgGraphicWidget
                  node={node}
                  onSaveSvg={(nextSvg: string) => {
                    sendOps([
                      {
                        op: 'update_node',
                        id: node.id,
                        patch: {
                          content: { svgCode: nextSvg },
                        },
                      },
                    ]);
                  }}
                />
              ) : node.type === 'table' ? (
                <TableWidget
                  node={node}
                  onUpdateTable={(nextTable: TableData, nextMd: string) => {
                    sendOps([
                      {
                        op: 'update_node',
                        id: node.id,
                        patch: {
                          content: {
                            tableData: nextTable,
                            body: nextMd,
                          },
                        },
                      },
                    ]);
                  }}
                />
              ) : node.type === 'text' ? (
                <div
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenEditModal(node);
                  }}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: node.style.color || '#f8fafc',
                    whiteSpace: 'pre-wrap',
                    cursor: 'text',
                    userSelect: 'text',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                  title="Double-click to edit text"
                >
                  {node.content.body || 'Click to type text...'}
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {inspectingJsonNodeId === node.id && node.content.structuredData ? (
                    <pre
                      style={{
                        fontSize: 10,
                        background: '#020617',
                        color: '#38bdf8',
                        padding: 8,
                        borderRadius: 6,
                        overflowX: 'auto',
                        marginBottom: 4,
                      }}
                    >
                      {JSON.stringify(node.content.structuredData, null, 2)}
                    </pre>
                  ) : (
                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.4,
                        opacity: 0.9,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {node.content.body}
                    </div>
                  )}

                  {isDataCard &&
                    node.content.structuredData &&
                    inspectingJsonNodeId !== node.id && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 4,
                          background: 'rgba(30, 41, 59, 0.8)',
                          padding: 6,
                          borderRadius: 6,
                          marginTop: 6,
                          fontSize: 11,
                        }}
                      >
                        {Object.entries(node.content.structuredData)
                          .slice(0, 4)
                          .map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ color: '#94a3b8' }}>{k}: </span>
                              <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                                {String(v)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Suggestion Accept / Dismiss Actions */}
            {isSuggestion && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendOps([{ op: 'accept_suggestion', id: node.id }]);
                  }}
                  style={{
                    flex: 1,
                    background: '#10b981',
                    color: '#052e16',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✓ Accept Gap Card
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendOps([{ op: 'delete_node', id: node.id }]);
                  }}
                  style={{
                    background: 'rgba(244, 63, 94, 0.2)',
                    color: '#fda4af',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Footer: ICM File Path Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 10,
                opacity: 0.72,
                marginTop: 4,
                paddingTop: 4,
                borderTop: '1px solid rgba(148,163,184,0.2)',
              }}
            >
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.icmFilePath) {
                    onOpenIcmFile(node.icmFilePath);
                  }
                }}
                style={{
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                title="Click to inspect this node's ICM Markdown file"
              >
                📄 {node.id}.md
              </span>
              <span>
                {Math.round(node.size.width)}×{Math.round(node.size.height)}
              </span>
            </div>

            {/* Right-side Connector Drag Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                const x = node.position.x + node.size.width;
                const y = node.position.y + node.size.height / 2;
                onStartConnecting(node.id, x, y);
              }}
              title="Drag from here to another card to connect with an arrow"
              style={{
                position: 'absolute',
                right: -10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#0f172a',
                border: '2px solid #38bdf8',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'crosshair',
              }}
            >
              →
            </div>
          </div>
        );
      })}
    </>
  );
}
