import React, { useState } from 'react';
import { EditingEdgeState } from '../../types.js';

interface ConnectorInspectorProps {
  editingEdge: EditingEdgeState | null;
  onClose: () => void;
  onUpdateEdge: (id: string, label: string, style: 'solid' | 'dashed' | 'animated') => void;
  onDeleteEdge: (id: string) => void;
}

/**
 * Floating inspector popover displayed when clicking on a connector line or label.
 * Allows switching between persistent solid, dashed, and animated flow styles,
 * and editing connector labels.
 */
export function ConnectorInspector({
  editingEdge,
  onClose,
  onUpdateEdge,
  onDeleteEdge,
}: ConnectorInspectorProps) {
  if (!editingEdge) return null;

  return (
    <InspectorInner
      editingEdge={editingEdge}
      onClose={onClose}
      onUpdateEdge={onUpdateEdge}
      onDeleteEdge={onDeleteEdge}
    />
  );
}

function InspectorInner({
  editingEdge,
  onClose,
  onUpdateEdge,
  onDeleteEdge,
}: {
  editingEdge: EditingEdgeState;
  onClose: () => void;
  onUpdateEdge: (id: string, label: string, style: 'solid' | 'dashed' | 'animated') => void;
  onDeleteEdge: (id: string) => void;
}) {
  const [label, setLabel] = useState(editingEdge.label);
  const [style, setStyle] = useState(editingEdge.style);

  const handleSave = () => {
    onUpdateEdge(editingEdge.id, label, style);
    onClose();
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: editingEdge.screenX,
        top: editingEdge.screenY,
        width: 300,
        background: 'rgba(15, 23, 42, 0.97)',
        border: '1.5px solid #f59e0b',
        borderRadius: 12,
        padding: 12,
        zIndex: 95,
        boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
          🔗 Edit Connector Line
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>

      <div>
        <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 4 }}>
          Line Label:
        </div>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          placeholder="e.g. persisted via, leads to, blocks..."
          style={{
            width: '100%',
            background: '#020617',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 12,
          }}
        />
      </div>

      <div>
        <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 4 }}>
          Connector Type:
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(
            [
              { id: 'solid', label: '─ Persistent (Grey)' },
              { id: 'dashed', label: '┄ Dashed' },
              { id: 'animated', label: '⋯ Flow (Blue)' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setStyle(opt.id)}
              style={{
                flex: 1,
                background:
                  style === opt.id ? 'rgba(56, 189, 248, 0.22)' : '#1e293b',
                color: style === opt.id ? '#38bdf8' : '#cbd5e1',
                border: `1px solid ${style === opt.id ? '#38bdf8' : '#475569'}`,
                borderRadius: 6,
                padding: '5px 4px',
                fontSize: 10.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        <button
          onClick={() => {
            onDeleteEdge(editingEdge.id);
            onClose();
          }}
          style={{
            background: 'rgba(244, 63, 94, 0.2)',
            color: '#fda4af',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Delete Line
        </button>
        <button
          onClick={handleSave}
          style={{
            background: '#38bdf8',
            color: '#0f172a',
            border: 'none',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Save Line
        </button>
      </div>
    </div>
  );
}
