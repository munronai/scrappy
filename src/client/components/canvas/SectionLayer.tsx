import React, { useState } from 'react';
import { BoardDocument, SectionNode } from '../../../core/index.js';
import { ResizeCorner } from '../../types.js';
import { CornerHandles } from './CornerHandles.js';

interface SectionLayerProps {
  board: BoardDocument;
  showResizeHandles: boolean;
  showNodeMetadata: boolean;
  onStartResizeSection: (id: string, corner: ResizeCorner, e: React.MouseEvent) => void;
  onStartDragSection: (id: string, e: React.MouseEvent) => void;
  onOpenScrappyContextMenu: (
    e: React.MouseEvent,
    targetNodeId?: string,
    explicitSectionId?: string
  ) => void;
  onOpenPipelineForSection: (sec: SectionNode) => void;
  onScopeSection: (sec: SectionNode) => void;
  onDeleteSection: (sectionId: string) => void;
}

/**
 * Renders ICM Scope Sections (stage frames).
 * Supports proportional child node scaling when resizing corner handles,
 * synchronized child dragging via header drag, and scoped contextual prompting.
 */
export function SectionLayer({
  board,
  showResizeHandles,
  showNodeMetadata,
  onStartResizeSection,
  onStartDragSection,
  onOpenScrappyContextMenu,
  onOpenPipelineForSection,
  onScopeSection,
  onDeleteSection,
}: SectionLayerProps) {
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);

  return (
    <>
      {Object.values(board.sections).map((sec: SectionNode) => {
        const lockedCount = Object.values(board.nodes).filter(
          (n) => n.sectionId === sec.id && n.lockedToSection !== false
        ).length;
        const isSectionScoped = board.activeSelection.sectionId === sec.id;
        const isHoveredSec = hoveredSectionId === sec.id;

        return (
          <div
            key={sec.id}
            onMouseEnter={() => setHoveredSectionId(sec.id)}
            onMouseLeave={() =>
              setHoveredSectionId((curr) => (curr === sec.id ? null : curr))
            }
            onContextMenu={(e) => onOpenScrappyContextMenu(e, undefined, sec.id)}
            style={{
              position: 'absolute',
              left: sec.bounds.x,
              top: sec.bounds.y,
              width: sec.bounds.width,
              height: sec.bounds.height,
              border: isSectionScoped
                ? `3px solid #38bdf8`
                : `1.5px dashed ${sec.color}88`,
              background: isSectionScoped ? 'rgba(56, 189, 248, 0.08)' : `${sec.color}0a`,
              borderRadius: 16,
              pointerEvents: 'auto',
              boxShadow: isSectionScoped
                ? '0 0 0 4px rgba(56, 189, 248, 0.2)'
                : 'none',
            }}
          >
            {/* 4 Corner Resize Handles */}
            <CornerHandles
              onStartCornerResize={(corner, e) => onStartResizeSection(sec.id, corner, e)}
              accentColor={sec.color}
              size={14}
              showResizeHandles={showResizeHandles}
            />

            {/* Floating Hover Toolbar with Extended Upper Boundary */}
            {isHoveredSec && (
              <div
                style={{
                  position: 'absolute',
                  top: -46,
                  left: -10,
                  right: -10,
                  height: 48,
                  pointerEvents: 'auto',
                  zIndex: 60,
                }}
              >
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(15, 23, 42, 0.94)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: 8,
                    padding: '3px 8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    pointerEvents: 'auto',
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPipelineForSection(sec);
                      setHoveredSectionId(null);
                    }}
                    style={{
                      background: 'rgba(16, 185, 129, 0.25)',
                      color: '#6ee7b7',
                      border: '1px solid rgba(16, 185, 129, 0.5)',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Compile this Scope Section into an ICM Pipeline (icm-architect)"
                  >
                    🏗️ ICM Pipeline
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onScopeSection(sec);
                      setHoveredSectionId(null);
                    }}
                    style={{
                      background: isSectionScoped ? '#38bdf8' : 'rgba(15, 23, 42, 0.75)',
                      color: isSectionScoped ? '#0f172a' : '#e2e8f0',
                      border: `1px solid ${sec.color}66`,
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: isSectionScoped ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {isSectionScoped ? '🎯 Scoped' : '🎯 Scope Section'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSection(sec.id);
                      setHoveredSectionId(null);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 6,
                      padding: '3px 7px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                    title="Delete Scope Section"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Draggable Section Header */}
            <div
              onMouseDown={(e) => {
                if (e.button === 2) return;
                e.stopPropagation();
                onStartDragSection(sec.id, e);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                background: `${sec.color}1a`,
                borderBottom: `1px solid ${sec.color}33`,
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
                cursor: 'move',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: '#f8fafc',
                  }}
                >
                  {sec.title}
                </span>
                {showNodeMetadata && (
                  <>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontFamily: 'monospace',
                        background: 'rgba(15, 23, 42, 0.7)',
                        color: sec.color,
                        padding: '1px 6px',
                        borderRadius: 5,
                      }}
                    >
                      sections/{sec.slug}/
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        color: '#cbd5e1',
                        background: 'rgba(15, 23, 42, 0.55)',
                        padding: '1px 5px',
                        borderRadius: 5,
                      }}
                    >
                      🔒 {lockedCount} locked
                    </span>
                  </>
                )}
              </div>
            </div>
            {sec.description && (
              <div
                style={{
                  padding: '6px 14px',
                  fontSize: 11.5,
                  color: '#94a3b8',
                }}
              >
                {sec.description}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
