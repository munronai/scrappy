import React from 'react';
import { ActiveTool } from '../../types.js';
import { chipStyle, dockBtnStyle } from '../../styles.js';

interface BottomDockProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  onAddNode: (
    type: 'sticky' | 'shape' | 'text' | 'checklist' | 'mermaid' | 'table' | 'image'
  ) => void;
  onAddSection: () => void;
  showQuickPromptBar: boolean;
  setShowQuickPromptBar: React.Dispatch<React.SetStateAction<boolean>>;
  promptText: string;
  setPromptText: (text: string) => void;
  onSubmitPrompt: (overrideText?: string) => void;
  isDictating: boolean;
  onToggleDictation: () => void;
  promptInputRef: React.Ref<HTMLInputElement>;
}

/**
 * Floating bottom tool dock and Quick Prompt bar ('Describe a change').
 * Provides one-click access to canvas tools (select, pan, text, section, widgets)
 * and the glowing 'Ask @scrappy' shortcut.
 */
export function BottomDock({
  activeTool,
  setActiveTool,
  onAddNode,
  onAddSection,
  showQuickPromptBar,
  setShowQuickPromptBar,
  promptText,
  setPromptText,
  onSubmitPrompt,
  isDictating,
  onToggleDictation,
  promptInputRef,
}: BottomDockProps) {
  return (
    <>
      {/* FLOATING QUICK PROMPT BAR (Cmd+K) */}
      {showQuickPromptBar && (
        <div
          style={{
            position: 'absolute',
            bottom: 74,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(580px, 92vw)',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: 16,
            border: '1px solid rgba(56, 189, 248, 0.45)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.65)',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 35,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={promptInputRef}
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitPrompt();
                if (e.key === 'Escape') setShowQuickPromptBar(false);
              }}
              placeholder="Describe a change or ask @scrappy..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: 13.5,
                outline: 'none',
              }}
              autoFocus
            />
            <button
              onClick={onToggleDictation}
              style={{
                background: isDictating
                  ? 'rgba(239, 68, 68, 0.25)'
                  : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 9px',
                color: '#f8fafc',
                cursor: 'pointer',
                fontSize: 13,
              }}
              title="Voice dictation"
            >
              {isDictating ? '🛑' : '🎙️'}
            </button>
            <button
              onClick={() => onSubmitPrompt()}
              style={{
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 8,
                width: 32,
                height: 32,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
              }}
              title="Submit prompt to @scrappy"
            >
              ↑
            </button>
          </div>

          {/* Quick Prompt Suggestion Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <button
              onClick={() =>
                onSubmitPrompt(
                  '@scrappy create an artistic graphic of our launch architecture'
                )
              }
              style={chipStyle}
            >
              🎨 artistic graphic
            </button>
            <button
              onClick={() =>
                onSubmitPrompt('@scrappy create a mermaid sequence diagram here')
              }
              style={chipStyle}
            >
              📊 mermaid diagram
            </button>
            <button
              onClick={() =>
                onSubmitPrompt('@scrappy create a comparison table with pros and cons')
              }
              style={chipStyle}
            >
              📋 comparison table
            </button>
            <button
              onClick={() =>
                onSubmitPrompt('@scrappy action open bugs in this checklist')
              }
              style={chipStyle}
            >
              ☑️ action checklist
            </button>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM ICON DOCK */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 12px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          borderRadius: 9999,
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow:
            '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          zIndex: 35,
        }}
      >
        {/* 1. Pointer (Select) */}
        <button
          onClick={() => setActiveTool('select')}
          style={dockBtnStyle(activeTool === 'select')}
          title="Pointer Selection Tool (V or 1) - Click & drag across canvas to marquee select"
        >
          ↖
        </button>

        {/* 2. Hand (Pan) */}
        <button
          onClick={() => setActiveTool('pan')}
          style={dockBtnStyle(activeTool === 'pan')}
          title="Hand Pan Tool (H or 2) - Click & drag canvas to pan viewport"
        >
          ✋
        </button>

        {/* 3. Freeform Text (T) */}
        <button
          onClick={() => onAddNode('text')}
          style={dockBtnStyle(false)}
          title="Freeform Text (T) - Direct text on canvas without card/shape border"
        >
          T
        </button>

        {/* 4. Section Grid */}
        <button
          onClick={onAddSection}
          style={dockBtnStyle(false)}
          title="Add Scope Section (#)"
        >
          #
        </button>

        {/* 5. Sticky Note */}
        <button
          onClick={() => onAddNode('sticky')}
          style={dockBtnStyle(false)}
          title="Add Sticky Note"
        >
          📝
        </button>

        {/* 6. Shape */}
        <button
          onClick={() => onAddNode('shape')}
          style={dockBtnStyle(false)}
          title="Add Shape"
        >
          ⬜
        </button>

        {/* 7. Checklist */}
        <button
          onClick={() => onAddNode('checklist')}
          style={dockBtnStyle(false)}
          title="Add Interactive Checklist"
        >
          ☑️
        </button>

        {/* 8. Mermaid */}
        <button
          onClick={() => onAddNode('mermaid')}
          style={dockBtnStyle(false)}
          title="Add Mermaid Diagram"
        >
          📊
        </button>

        {/* 9. Table */}
        <button
          onClick={() => onAddNode('table')}
          style={dockBtnStyle(false)}
          title="Add Interactive Table"
        >
          📋
        </button>

        {/* 10. Image */}
        <button
          onClick={() => onAddNode('image')}
          style={dockBtnStyle(false)}
          title="Add Image (Cmd+V)"
        >
          🖼️
        </button>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: 'rgba(255,255,255,0.18)',
            margin: '0 4px',
          }}
        />

        {/* Ask @scrappy Glowing Pill Button */}
        <button
          onClick={() => setShowQuickPromptBar((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: showQuickPromptBar
              ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.4), rgba(168, 85, 247, 0.4))'
              : 'linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(168, 85, 247, 0.22))',
            color: '#f8fafc',
            border: '1px solid rgba(56, 189, 248, 0.5)',
            borderRadius: 9999,
            padding: '6px 14px',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.2)',
            transition: 'all 0.15s ease',
          }}
          title="Ask @scrappy (AI Agent for canvas modifications)"
        >
          <span>✨</span>
          <span>Ask @scrappy</span>
        </button>
      </div>
    </>
  );
}
