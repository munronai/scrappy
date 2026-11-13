import React from 'react';
import { BoardDocument, PromptExecutionRoute, RegisteredICMPipeline } from '../../../core/index.js';
import { ContextDialogState } from '../../types.js';
import { chipStyle } from '../../styles.js';

interface ScrappyContextDialogProps {
  contextDialog: ContextDialogState | null;
  board: BoardDocument;
  selectedCount: number;
  promptText: string;
  setPromptText: (text: string) => void;
  isDictating: boolean;
  toggleDictation: () => void;
  promptMode: 'icm' | 'standalone_api';
  setPromptMode: (mode: 'icm' | 'standalone_api') => void;
  executionRoute: PromptExecutionRoute;
  setExecutionRoute: (route: PromptExecutionRoute) => void;
  selectedPipelineId: string;
  setSelectedPipelineId: (id: string) => void;
  matchedPipelines: RegisteredICMPipeline[];
  registeredPipelines: RegisteredICMPipeline[];
  apiProvider: 'gemini' | 'anthropic' | 'openai';
  setApiProvider: (provider: 'gemini' | 'anthropic' | 'openai') => void;
  apiKeyInput: string;
  setApiKeyInput: (key: string) => void;
  showApiConfig: boolean;
  setShowApiConfig: React.Dispatch<React.SetStateAction<boolean>>;
  promptInputRef: React.Ref<HTMLInputElement>;
  onClose: () => void;
  onSubmitPrompt: (overrideText?: string) => void;
}

/**
 * Floating cursor-anchored dialog for issuing prompts to `@scrappy`.
 * Supports ICM mode (/update-scrappy contract), voice dictation, top-level `CONTEXT.md`
 * pipeline routing, and direct LLM API invocation.
 */
export function ScrappyContextDialog({
  contextDialog,
  board,
  selectedCount,
  promptText,
  setPromptText,
  isDictating,
  toggleDictation,
  promptMode,
  setPromptMode,
  executionRoute,
  setExecutionRoute,
  selectedPipelineId,
  setSelectedPipelineId,
  matchedPipelines,
  registeredPipelines,
  apiProvider,
  setApiProvider,
  apiKeyInput,
  setApiKeyInput,
  showApiConfig,
  setShowApiConfig,
  promptInputRef,
  onClose,
  onSubmitPrompt,
}: ScrappyContextDialogProps) {
  if (!contextDialog) return null;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left: contextDialog.screenX,
        top: contextDialog.screenY,
        width: 430,
        background: 'rgba(15, 23, 42, 0.97)',
        backdropFilter: 'blur(18px)',
        border: '1.5px solid #38bdf8',
        borderRadius: 14,
        padding: 13,
        zIndex: 90,
        boxShadow:
          '0 20px 45px rgba(0,0,0,0.65), 0 0 0 4px rgba(56, 189, 248, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              background: 'linear-gradient(135deg, #38bdf8, #a855f7)',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            @scrappy
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            at ({contextDialog.boardX}, {contextDialog.boardY})
            {contextDialog.targetNodeId
              ? ` • Card: ${board.nodes[contextDialog.targetNodeId]?.content.title?.slice(0, 18)}`
              : contextDialog.targetSectionId
              ? ` • ${board.sections[contextDialog.targetSectionId]?.title}`
              : selectedCount > 0
              ? ` • Focus Region (${selectedCount} cards)`
              : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          ✕
        </button>
      </div>

      {/* Input Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={toggleDictation}
          style={{
            background: isDictating ? '#ef4444' : 'rgba(30, 41, 59, 0.95)',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: 8,
            padding: '8px 10px',
            cursor: 'pointer',
            fontSize: 12,
            whiteSpace: 'nowrap',
          }}
          title="Voice dictate your @scrappy prompt"
        >
          {isDictating ? '🛑 Stop' : '🎙️'}
        </button>

        <input
          ref={promptInputRef}
          type="text"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmitPrompt();
            if (e.key === 'Escape') onClose();
          }}
          placeholder="@scrappy create a graphic, mermaid diagram, checklist, or flow..."
          style={{
            flex: 1,
            background: '#020617',
            color: '#f8fafc',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 8,
            padding: '8px 11px',
            fontSize: 13,
            outline: 'none',
          }}
        />

        <button
          onClick={() => onSubmitPrompt()}
          style={{
            background: promptMode === 'icm' ? '#a855f7' : '#38bdf8',
            color: promptMode === 'icm' ? '#ffffff' : '#0f172a',
            fontWeight: 700,
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 12,
            whiteSpace: 'nowrap',
          }}
        >
          {promptMode === 'icm' ? 'Write ICM ↵' : 'Run API ↵'}
        </button>
      </div>

      {/* TOP-LEVEL ICM ROUTING & PIPELINE SELECTOR */}
      <div
        style={{
          background: 'rgba(2, 6, 23, 0.85)',
          border:
            executionRoute === 'pipeline'
              ? '1px solid rgba(16, 185, 129, 0.6)'
              : '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: 10,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8' }}>
            🧭 ICM Top-Level Routing (`CONTEXT.md`):
          </span>
          {matchedPipelines.length > 0 && (
            <span
              style={{
                fontSize: 10,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#6ee7b7',
                padding: '1px 6px',
                borderRadius: 999,
                fontWeight: 700,
              }}
            >
              ✨ Auto-Matched: {matchedPipelines[0].title}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          <button
            type="button"
            onClick={() => {
              setExecutionRoute('pipeline');
              if (!selectedPipelineId && registeredPipelines[0]) {
                setSelectedPipelineId(
                  matchedPipelines[0]?.id || registeredPipelines[0].id
                );
              }
            }}
            style={{
              flex: 1,
              background:
                executionRoute === 'pipeline'
                  ? 'rgba(16, 185, 129, 0.22)'
                  : '#0f172a',
              color: executionRoute === 'pipeline' ? '#6ee7b7' : '#94a3b8',
              border: `1px solid ${
                executionRoute === 'pipeline'
                  ? '#10b981'
                  : 'rgba(148,163,184,0.25)'
              }`,
              borderRadius: 6,
              padding: '5px 6px',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🎯 Run ICM Pipeline
          </button>
          <button
            type="button"
            onClick={() => setExecutionRoute('adhoc')}
            style={{
              flex: 1,
              background:
                executionRoute === 'adhoc'
                  ? 'rgba(56, 189, 248, 0.22)'
                  : '#0f172a',
              color: executionRoute === 'adhoc' ? '#38bdf8' : '#94a3b8',
              border: `1px solid ${
                executionRoute === 'adhoc'
                  ? '#38bdf8'
                  : 'rgba(148,163,184,0.25)'
              }`,
              borderRadius: 6,
              padding: '5px 6px',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🧠 Let Agent Decide
          </button>
          <button
            type="button"
            onClick={() => setExecutionRoute('scaffold_pipeline')}
            style={{
              flex: 1,
              background:
                executionRoute === 'scaffold_pipeline'
                  ? 'rgba(168, 85, 247, 0.25)'
                  : '#0f172a',
              color:
                executionRoute === 'scaffold_pipeline' ? '#d8b4fe' : '#94a3b8',
              border: `1px solid ${
                executionRoute === 'scaffold_pipeline'
                  ? '#a855f7'
                  : 'rgba(148,163,184,0.25)'
              }`,
              borderRadius: 6,
              padding: '5px 6px',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🏗️ Build Pipeline
          </button>
        </div>

        {executionRoute === 'pipeline' && registeredPipelines.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <select
              value={selectedPipelineId || registeredPipelines[0].id}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: 11,
              }}
            >
              {registeredPipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  🎯 {p.title} ({p.stages.length} stages •{' '}
                  {p.configRefs[0] || '_config/'})
                </option>
              ))}
            </select>
            {(() => {
              const activePipe =
                registeredPipelines.find((p) => p.id === selectedPipelineId) ||
                registeredPipelines[0];
              if (!activePipe) return null;
              return (
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.35 }}>
                  <span style={{ color: '#6ee7b7', fontFamily: 'monospace' }}>
                    {activePipe.stages.join(' → ')}
                  </span>{' '}
                  • Enforces{' '}
                  <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {activePipe.configRefs.join(', ')}
                  </span>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Quick Suggestion Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <button
          onClick={() =>
            onSubmitPrompt(
              '@scrappy create an artistic graphic of our launch architecture'
            )
          }
          style={chipStyle}
        >
          🎨 @scrappy artistic graphic
        </button>
        <button
          onClick={() =>
            onSubmitPrompt('@scrappy create a mermaid sequence diagram here')
          }
          style={chipStyle}
        >
          📊 @scrappy mermaid diagram
        </button>
        <button
          onClick={() =>
            onSubmitPrompt('@scrappy create a comparison table with pros and cons')
          }
          style={chipStyle}
        >
          📋 @scrappy comparison table
        </button>
        <button
          onClick={() =>
            onSubmitPrompt('@scrappy action the open bugs in this checklist')
          }
          style={chipStyle}
        >
          ☑️ @scrappy action checklist bugs
        </button>
        <button
          onClick={() => onSubmitPrompt('@scrappy find the missing gaps here')}
          style={chipStyle}
        >
          ✨ @scrappy find gaps
        </button>
      </div>

      {/* Footer: Mode Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
          borderTop: '1px solid rgba(148,163,184,0.18)',
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setPromptMode('icm')}
            style={{
              ...chipStyle,
              background:
                promptMode === 'icm' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
              borderColor:
                promptMode === 'icm' ? '#a855f7' : 'rgba(148,163,184,0.2)',
              color: promptMode === 'icm' ? '#e9d5ff' : '#94a3b8',
            }}
          >
            📂 ICM File (`/update-scrappy`)
          </button>
          <button
            onClick={() => setPromptMode('standalone_api')}
            style={{
              ...chipStyle,
              background:
                promptMode === 'standalone_api'
                  ? 'rgba(56, 189, 248, 0.22)'
                  : 'transparent',
              borderColor:
                promptMode === 'standalone_api'
                  ? '#38bdf8'
                  : 'rgba(148,163,184,0.2)',
              color: promptMode === 'standalone_api' ? '#bae6fd' : '#94a3b8',
            }}
          >
            ☁️ Standalone Model API
          </button>
        </div>

        {promptMode === 'standalone_api' && (
          <button
            onClick={() => setShowApiConfig((s) => !s)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontSize: 11,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showApiConfig ? 'Hide Key' : 'API Key'}
          </button>
        )}
      </div>

      {promptMode === 'standalone_api' && showApiConfig && (
        <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
          <select
            value={apiProvider}
            onChange={(e) =>
              setApiProvider(e.target.value as 'gemini' | 'anthropic' | 'openai')
            }
            style={{
              background: '#020617',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 6px',
            }}
          >
            <option value="gemini">Gemini API</option>
            <option value="anthropic">Claude API</option>
            <option value="openai">OpenAI API</option>
          </select>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Optional API Key (or set in env)"
            style={{
              flex: 1,
              background: '#020617',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11,
            }}
          />
        </div>
      )}
    </div>
  );
}
