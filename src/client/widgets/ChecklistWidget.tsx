import React, { useState } from 'react';
import type { CanvasNode, ChecklistItem } from '../../core/types.js';

/**
 * Interactive checklist widget persisted across restarts in the node's ICM file.
 */
export function ChecklistWidget({
  node,
  onUpdateItems,
  onActionOpenItems,
}: {
  node: CanvasNode;
  onUpdateItems: (items: ChecklistItem[]) => void;
  onActionOpenItems: () => void;
}) {
  const [newItemText, setNewItemText] = useState('');
  const items: ChecklistItem[] = node.content.checklistItems || [];
  const checkedCount = items.filter((i) => i.checked).length;

  const handleToggle = (id: string) => {
    const next = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    onUpdateItems(next);
  };

  const handleDelete = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    onUpdateItems(next);
  };

  const handleAdd = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    const next: ChecklistItem[] = [
      ...items,
      {
        id: `item-${Date.now().toString(36).slice(-4)}`,
        text: trimmed,
        checked: false,
      },
    ];
    setNewItemText('');
    onUpdateItems(next);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flex: 1,
        overflow: 'hidden',
      }}
    >
      {/* Progress bar & count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ fontWeight: 700, opacity: 0.8 }}>
          ✓ {checkedCount}/{items.length} completed
        </span>
        {items.some((i) => !i.checked) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActionOpenItems();
            }}
            style={{
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px solid #38bdf8',
              borderRadius: 6,
              padding: '2px 7px',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Ask @scrappy to action unchecked items in this checklist"
          >
            ⚡ Action Open w/ @scrappy
          </button>
        )}
      </div>

      {/* Scrollable Checklist Items */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          paddingRight: 2,
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.08)',
              padding: '4px 7px',
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                flex: 1,
                cursor: 'pointer',
                textDecoration: item.checked ? 'line-through' : 'none',
                opacity: item.checked ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleToggle(item.id)}
                style={{ cursor: 'pointer', accentColor: '#0f172a', width: 14, height: 14 }}
              />
              <span style={{ wordBreak: 'break-word' }}>{item.text}</span>
            </label>
            <button
              onClick={() => handleDelete(item.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#475569',
                cursor: 'pointer',
                fontSize: 11,
                padding: '0 3px',
              }}
              title="Remove item"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add new bug / checklist item row */}
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="+ Add bug or task..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.75)',
            color: '#0f172a',
            border: '1px solid rgba(15, 23, 42, 0.25)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11.5,
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            background: '#0f172a',
            color: '#f8fafc',
            border: 'none',
            borderRadius: 6,
            padding: '4px 9px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
