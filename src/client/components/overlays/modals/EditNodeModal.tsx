import React, { useState } from 'react';
import { CanvasNode } from '../../../../core/index.js';
import { CARD_COLORS } from '../../../types.js';
import { toolBtnStyle } from '../../../styles.js';

interface EditNodeModalProps {
  node: CanvasNode | null;
  onClose: () => void;
  onSave: (nodeId: string, title: string, body: string, color: string) => Promise<void>;
}

/**
 * Modal for editing a card's title, markdown body, and color, persisting directly to its ICM file.
 */
export function EditNodeModal({ node, onClose, onSave }: EditNodeModalProps) {
  if (!node) return null;

  return (
    <EditNodeModalInner node={node} onClose={onClose} onSave={onSave} />
  );
}

function EditNodeModalInner({
  node,
  onClose,
  onSave,
}: {
  node: CanvasNode;
  onClose: () => void;
  onSave: (nodeId: string, title: string, body: string, color: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(node.content.title || '');
  const [body, setBody] = useState(node.content.body || '');
  const [color, setColor] = useState(node.style.color || '#fef08a');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440,
          background: '#0f172a',
          border: '1px solid #38bdf8',
          borderRadius: 12,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc' }}>
          Edit Card ({node.id}.md)
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Card Title"
          style={{
            background: '#020617',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
          }}
        />
        <textarea
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Markdown body content..."
          style={{
            background: '#020617',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />

        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
            Card Colour:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {CARD_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setColor(c.hex)}
                title={c.name}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: c.hex,
                  border:
                    color === c.hex
                      ? '3px solid #38bdf8'
                      : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={toolBtnStyle(false)}>
            Cancel
          </button>
          <button
            onClick={async () => {
              await onSave(node.id, title, body, color);
              onClose();
            }}
            style={{
              ...toolBtnStyle(true, '#38bdf8'),
              fontWeight: 700,
            }}
          >
            Save to ICM File
          </button>
        </div>
      </div>
    </div>
  );
}
