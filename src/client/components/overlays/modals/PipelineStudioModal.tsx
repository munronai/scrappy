import React, { useState } from 'react';
import {
  BoardDocument,
  NodeType,
  RegisteredICMPipeline,
  SectionNode,
} from '../../../../core/index.js';
import { toolBtnStyle } from '../../../styles.js';

interface PipelineStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: BoardDocument;
  targetSectionId?: string;
  selectedCount: number;
  registeredPipelines: RegisteredICMPipeline[];
  onBuildPipeline: (opts: {
    title: string;
    triggerIntents: string[];
    sectionId?: string;
    outputType: NodeType;
  }) => Promise<void>;
  onInspectPipelineIcm: (routingPath: string) => void;
}

/**
 * ICM Architect Studio modal for compiling whiteboard brainstorms into reusable ICM pipelines
 * and inspecting registered pipelines in `CONTEXT.md`.
 */
export function PipelineStudioModal({
  isOpen,
  onClose,
  board,
  targetSectionId,
  selectedCount,
  registeredPipelines,
  onBuildPipeline,
  onInspectPipelineIcm,
}: PipelineStudioModalProps) {
  const [pipelineTitle, setPipelineTitle] = useState('Brand Content & Asset Pipeline');
  const [pipelineTriggers, setPipelineTriggers] = useState('brand, content, campaign');
  const [outputType, setOutputType] = useState<NodeType>('svg_graphic');
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(targetSectionId);
  const [building, setBuilding] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: '#0f172a',
          border: '1.5px solid #10b981',
          borderRadius: 14,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 24px 50px rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc' }}>
              🏗️ ICM Architect Studio — Build & Route ICM Pipelines (`RinDig/icm-architect`)
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
              Top-Level Routing File:{' '}
              <code style={{ color: '#6ee7b7' }}>
                {board.icmWorkspace?.rootRoutingFile || `boards/${board.name}/CONTEXT.md`}
              </code>{' '}
              •{' '}
              <span style={{ color: '#10b981', fontWeight: 700 }}>
                {board.icmWorkspace?.lastWalkTest?.passed !== false
                  ? `✅ Cold-Agent Walk Test Passed (${
                      board.icmWorkspace?.lastWalkTest?.stagesChecked || 12
                    } stages)`
                  : '⚠️ Check References'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Section 1: Compile Brainstorm / Scope Section into New ICM Pipeline */}
        <div
          style={{
            background: 'rgba(2, 6, 23, 0.75)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: '#6ee7b7' }}>
            1. Compile Whiteboard Brainstorm into a Reusable ICM Pipeline
          </div>
          <div style={{ fontSize: 11.5, color: '#cbd5e1' }}>
            Source Scope:{' '}
            <strong>
              {selectedSectionId && board.sections[selectedSectionId]
                ? `Scope Section "${board.sections[selectedSectionId].title}"`
                : selectedCount > 0
                ? `${selectedCount} Selected Cards`
                : 'Active Board Cards'}
            </strong>{' '}
            → Scaffolds numbered folders (
            <code>pipelines/&lt;slug&gt;/stages/01-.../CONTEXT.md</code>), links{' '}
            <code>_config/brand-guidelines.md</code>, registers in top-level{' '}
            <code>CONTEXT.md</code>, and runs the <strong>Walk Test</strong>.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                Pipeline Name:
              </div>
              <input
                value={pipelineTitle}
                onChange={(e) => setPipelineTitle(e.target.value)}
                placeholder="e.g. Brand Image Generator"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 9px',
                  fontSize: 12,
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                <code>@scrappy</code> Trigger Intents (comma-separated):
              </div>
              <input
                value={pipelineTriggers}
                onChange={(e) => setPipelineTriggers(e.target.value)}
                placeholder="e.g. image, hero, illustration, brand"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 9px',
                  fontSize: 12,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Target Scope Section:</span>
              <select
                value={selectedSectionId || ''}
                onChange={(e) =>
                  setSelectedSectionId(e.target.value ? e.target.value : undefined)
                }
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 11.5,
                }}
              >
                <option value="">All / Selected Cards on Board</option>
                {Object.values(board.sections).map((s: SectionNode) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.slug})
                  </option>
                ))}
              </select>

              <span style={{ fontSize: 11, color: '#94a3b8' }}>Output Widget:</span>
              <select
                value={outputType}
                onChange={(e) => setOutputType(e.target.value as NodeType)}
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 11.5,
                }}
              >
                <option value="svg_graphic">🎨 Artistic SVG Graphic</option>
                <option value="checklist">☑️ Interactive Checklist</option>
                <option value="mermaid">📊 Mermaid Diagram</option>
                <option value="sticky">🟨 Connected Stage Cards</option>
              </select>
            </div>

            <button
              onClick={async () => {
                setBuilding(true);
                try {
                  const triggerList = pipelineTriggers
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean);
                  await onBuildPipeline({
                    title: pipelineTitle,
                    triggerIntents: triggerList,
                    sectionId: selectedSectionId,
                    outputType,
                  });
                } finally {
                  setBuilding(false);
                }
              }}
              disabled={building}
              style={{
                background: '#10b981',
                color: '#052e16',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {building ? 'Compiling...' : '🏗️ Compile ICM Pipeline + Walk Test'}
            </button>
          </div>
        </div>

        {/* Section 2: Registered ICM Pipelines in Top-Level CONTEXT.md */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>
            2. Registered ICM Pipelines in Top-Level Routing File (<code>CONTEXT.md</code>)
          </div>
          {registeredPipelines.map((pipe) => (
            <div
              key={pipe.id}
              style={{
                background: 'rgba(30, 41, 59, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.22)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: '#f8fafc' }}>
                    🎯 {pipe.title}
                  </span>
                  <code
                    style={{
                      fontSize: 10,
                      background: '#020617',
                      color: '#38bdf8',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {pipe.routingPath}
                  </code>
                  <span
                    style={{
                      fontSize: 10,
                      color: '#10b981',
                      fontWeight: 700,
                    }}
                  >
                    ✓ Walk Test OK
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                  {pipe.description}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#cbd5e1',
                    marginTop: 4,
                    fontFamily: 'monospace',
                  }}
                >
                  Stages: {pipe.stages.join(' → ')} | Triggers:{' '}
                  {pipe.triggerIntents.slice(0, 5).join(', ')}
                </div>
              </div>
              <button
                onClick={() => onInspectPipelineIcm(pipe.routingPath)}
                style={toolBtnStyle(false)}
              >
                📄 Inspect ICM
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
