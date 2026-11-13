import React, { useCallback, useEffect, useState } from 'react';
import { PromptRequest } from '../../../core/index.js';
import { DrawerTab } from '../../types.js';
import { tabBtnStyle } from '../../styles.js';

interface GlassBoxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
  prompts: PromptRequest[];
  activityLog: Array<{ time: string; actor: string; text: string }>;
  activeTab?: DrawerTab;
  onTabChange?: (tab: DrawerTab) => void;
  inspectedFilePath?: string;
}

/**
 * Collapsible glass-box inspector drawer.
 * Provides transparent access to:
 * 1. `@scrappy` prompt queue and runner instructions (`/update-scrappy`)
 * 2. Live ICM Option A file tree inspector (`boards/<name>/`)
 * 3. Board exports (Markdown PRD & Mermaid flowchart)
 */
export function GlassBoxDrawer({
  isOpen,
  onClose,
  boardName,
  prompts,
  activityLog,
  activeTab,
  onTabChange,
  inspectedFilePath,
}: GlassBoxDrawerProps) {
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(activeTab || 'agy');
  const [icmFiles, setIcmFiles] = useState<Array<{ path: string; size: number; preview: string }>>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    inspectedFilePath || '_prompts/ACTIVE_PROMPT.md'
  );

  useEffect(() => {
    if (activeTab) setDrawerTab(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (inspectedFilePath) setSelectedFilePath(inspectedFilePath);
  }, [inspectedFilePath]);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'mermaid'>('markdown');
  const [exportedText, setExportedText] = useState<string>('');
  const [copiedBanner, setCopiedBanner] = useState<string | null>(null);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBanner(label);
    setTimeout(() => setCopiedBanner(null), 2500);
  }, []);

  const fetchIcmFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/boards/${boardName}/files`);
      if (res.ok) {
        const data = await res.json();
        const files: Array<{ path: string; size: number; preview: string }> = data.files || [];
        setIcmFiles(files);
        if (files.length > 0 && !files.some((f) => f.path === selectedFilePath)) {
          setSelectedFilePath(files[0].path);
        }
      }
    } catch {
      // offline fallback
    }
  }, [boardName, selectedFilePath]);

  const fetchExport = useCallback(
    async (fmt: 'markdown' | 'mermaid') => {
      try {
        const res = await fetch(`/api/v1/boards/${boardName}/export?format=${fmt}`);
        if (res.ok) {
          const data = await res.json();
          setExportedText(data.content || '');
        }
      } catch {
        // offline fallback
      }
    },
    [boardName]
  );

  useEffect(() => {
    if (isOpen) {
      if (drawerTab === 'icm') {
        fetchIcmFiles();
      } else if (drawerTab === 'export') {
        fetchExport(exportFormat);
      }
    }
  }, [isOpen, drawerTab, fetchIcmFiles, fetchExport, exportFormat]);

  if (!isOpen) return null;

  const currentFileObj = icmFiles.find((f) => f.path === selectedFilePath) || icmFiles[0];
  const pendingPrompts = prompts.filter((p) => p.status === 'pending');

  return (
    <div
      style={{
        width: 400,
        height: '100vh',
        background: '#0f172a',
        borderLeft: '1px solid rgba(148, 163, 184, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
      }}
    >
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          padding: '10px 12px',
          gap: 6,
        }}
      >
        <button
          onClick={() => setDrawerTab('agy')}
          style={tabBtnStyle(drawerTab === 'agy')}
        >
          🐚 `/update-scrappy` ({pendingPrompts.length})
        </button>
        <button
          onClick={() => {
            setDrawerTab('icm');
            fetchIcmFiles();
          }}
          style={tabBtnStyle(drawerTab === 'icm')}
        >
          📂 ICM Files ({icmFiles.length})
        </button>
        <button
          onClick={() => {
            setDrawerTab('export');
            fetchExport(exportFormat);
          }}
          style={tabBtnStyle(drawerTab === 'export')}
        >
          📄 Export
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 13,
            padding: '0 4px',
          }}
          title="Collapse Panel"
        >
          ✕
        </button>
      </div>

      {copiedBanner && (
        <div
          style={{
            background: '#10b981',
            color: '#052e16',
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          ✓ Copied {copiedBanner} to clipboard!
        </div>
      )}

      {drawerTab === 'agy' && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: '#e9d5ff',
                marginBottom: 6,
              }}
            >
              Right-Click `@scrappy` + `/update-scrappy` Skill
            </div>
            <p
              style={{
                fontSize: 12,
                color: '#cbd5e1',
                lineHeight: 1.45,
                marginBottom: 8,
              }}
            >
              1. <strong>Right-click</strong> anywhere on the canvas and type or dictate{' '}
              <code>@scrappy ...</code>.<br />
              2. In <strong>ICM Mode</strong>, it writes to{' '}
              <code>boards/{boardName}/_prompts/ACTIVE_PROMPT.md</code>.<br />
              3. Run <strong><code>/update-scrappy</code></strong> in Antigravity CLI (<code>agy</code>)!
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() =>
                  copyToClipboard('/update-scrappy', '/update-scrappy command')
                }
                style={{
                  flex: 1,
                  background: '#a855f7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📋 Copy `/update-scrappy`
              </button>
              <button
                onClick={() =>
                  copyToClipboard(
                    `npm run wb -- update-scrappy --board ${boardName}`,
                    'CLI Command'
                  )
                }
                style={{
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                📋 Copy CLI Runner
              </button>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: 8,
              }}
            >
              `@scrappy` PROMPT QUEUE ({prompts.length})
            </div>
            {prompts.length === 0 ? (
              <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                Right-click anywhere on the whiteboard canvas to open the @scrappy prompt popup!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...prompts].reverse().map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: '#1e293b',
                      border: `1px solid ${
                        p.status === 'pending' ? '#a855f7' : 'rgba(148,163,184,0.2)'
                      }`,
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          color: p.status === 'completed' ? '#34d399' : '#c084fc',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        ● {p.status} ({p.mode})
                      </span>
                      <span style={{ color: '#64748b' }}>
                        {p.anchorPosition
                          ? `@(${p.anchorPosition.x},${p.anchorPosition.y})`
                          : p.id}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#f8fafc',
                        fontWeight: 600,
                        marginBottom: 6,
                      }}
                    >
                      “{p.prompt}”
                    </div>
                    {p.agentResponseSummary && (
                      <div
                        style={{
                          fontSize: 11,
                          color: '#94a3b8',
                          background: '#0f172a',
                          padding: 6,
                          borderRadius: 6,
                        }}
                      >
                        🤖 {p.agentResponseSummary}
                      </div>
                    )}
                    {p.status === 'pending' && (
                      <button
                        onClick={async () => {
                          await fetch(
                            `/api/v1/boards/${boardName}/prompts/${p.id}/resolve`,
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ runInstantFallback: true }),
                            }
                          );
                        }}
                        style={{
                          marginTop: 6,
                          width: '100%',
                          background: '#a855f7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ⚡ Run `/update-scrappy` Now
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#94a3b8',
                marginBottom: 8,
              }}
            >
              LIVE ICM & AGENT STREAM
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activityLog.length === 0 ? (
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Watching `boards/{boardName}/` via chokidar & WebSockets...
                </div>
              ) : (
                activityLog.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 11,
                      background: '#020617',
                      padding: '6px 8px',
                      borderRadius: 6,
                      borderLeft: '2px solid #38bdf8',
                    }}
                  >
                    <span style={{ color: '#64748b' }}>[{item.time}] </span>
                    <strong style={{ color: '#38bdf8' }}>{item.actor}: </strong>
                    <span style={{ color: '#cbd5e1' }}>{item.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {drawerTab === 'icm' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid rgba(148,163,184,0.15)',
            }}
          >
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
              ICM Option A Files in <code>boards/{boardName}/</code> (Click to inspect):
            </div>
            <select
              value={selectedFilePath}
              onChange={(e) => setSelectedFilePath(e.target.value)}
              style={{
                width: '100%',
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            >
              {icmFiles.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.path} ({f.size}B)
                </option>
              ))}
            </select>
          </div>
          <pre
            style={{
              flex: 1,
              margin: 0,
              padding: 12,
              background: '#020617',
              color: '#e2e8f0',
              fontSize: 11,
              lineHeight: 1.5,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {currentFileObj ? currentFileObj.preview : 'Select a file to inspect...'}
          </pre>
        </div>
      )}

      {drawerTab === 'export' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 12,
            gap: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => {
                  setExportFormat('markdown');
                  fetchExport('markdown');
                }}
                style={tabBtnStyle(exportFormat === 'markdown')}
              >
                Markdown PRD
              </button>
              <button
                onClick={() => {
                  setExportFormat('mermaid');
                  fetchExport('mermaid');
                }}
                style={tabBtnStyle(exportFormat === 'mermaid')}
              >
                Mermaid Flowchart
              </button>
            </div>
            <button
              onClick={() => copyToClipboard(exportedText, exportFormat.toUpperCase())}
              style={{
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              📋 Copy {exportFormat}
            </button>
          </div>
          <pre
            style={{
              flex: 1,
              margin: 0,
              padding: 12,
              background: '#020617',
              color: '#cbd5e1',
              fontSize: 11,
              lineHeight: 1.5,
              borderRadius: 8,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {exportedText}
          </pre>
        </div>
      )}
    </div>
  );
}
