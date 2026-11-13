import React, { useState } from 'react';
import { BoardListing, UserIdentity, USER_PALETTES, ViewportState } from '../../types.js';
import { dropdownActionBtnStyle, toolBtnStyle } from '../../styles.js';
import { CollaboratorPresence } from '../../../core/index.js';
import { TransportMode } from '../../../realtime/types.js';

interface TopBarProps {
  boardName: string;
  boardTitle: string;
  boardVersion: number;
  wsConnected: boolean;
  availableBoards: BoardListing[];
  onSwitchBoard: (name: string) => void;
  onFetchAvailableBoards: () => void;
  onStartCleanBoard: () => void;
  onStartTemplate: () => void;
  onDuplicateBoard: () => void;
  onReloadBoard: () => void;
  selectedCount: number;
  hasSectionScope: boolean;
  onClearScope: () => void;
  viewport: ViewportState;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset?: () => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  showCardBorders: boolean;
  onToggleCardBorders: (val: boolean) => void;
  showResizeHandles: boolean;
  onToggleResizeHandles: (val: boolean) => void;
  showNodeMetadata: boolean;
  onToggleNodeMetadata: (val: boolean) => void;
  defaultEdgeStyle: 'solid' | 'dashed' | 'animated';
  onChangeDefaultEdgeStyle: (val: 'solid' | 'dashed' | 'animated') => void;
  registeredPipelinesCount: number;
  onOpenPipelineModal: () => void;
  promptMode: 'icm' | 'standalone_api';
  onTogglePromptMode: () => void;
  pendingPromptsCount: number;
  collaborators?: CollaboratorPresence[];
  currentUser?: UserIdentity;
  onUpdateIdentity?: (updates: Partial<UserIdentity>) => void;
  followingActorId?: string | null;
  onToggleFollow?: (actorId: string) => void;
  onStopFollow?: () => void;
  transportMode?: TransportMode;
  onOpenShareModal?: () => void;
  isPasscodeProtected?: boolean;
}

/**
 * Minimalist glassmorphic top navigation bar.
 * Houses board switching, live connection badge, zoom controls, view configuration,
 * ICM pipeline builder trigger, and drawer expansion toggle.
 */
export function TopBar({
  boardName,
  boardTitle,
  boardVersion,
  wsConnected,
  availableBoards,
  onSwitchBoard,
  onFetchAvailableBoards,
  onStartCleanBoard,
  onStartTemplate,
  onDuplicateBoard,
  onReloadBoard,
  selectedCount,
  hasSectionScope,
  onClearScope,
  viewport,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  drawerOpen,
  onToggleDrawer,
  showCardBorders,
  onToggleCardBorders,
  showResizeHandles,
  onToggleResizeHandles,
  showNodeMetadata,
  onToggleNodeMetadata,
  defaultEdgeStyle,
  onChangeDefaultEdgeStyle,
  registeredPipelinesCount,
  onOpenPipelineModal,
  promptMode,
  onTogglePromptMode,
  pendingPromptsCount,
  collaborators = [],
  currentUser,
  onUpdateIdentity,
  followingActorId,
  onToggleFollow,
  onStopFollow,
  transportMode = 'ws',
  onOpenShareModal,
  isPasscodeProtected = false,
}: TopBarProps) {
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showIdentityPopover, setShowIdentityPopover] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 18,
        right: drawerOpen ? 418 : 18,
        height: 48,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        zIndex: 30,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        transition: 'right 0.2s ease',
      }}
    >
      {/* Left: Board Title & Live Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: wsConnected ? '#10b981' : '#f43f5e',
            boxShadow: wsConnected ? '0 0 8px #10b981' : 'none',
          }}
          title={wsConnected ? 'Live WebSocket Connected' : 'Disconnected'}
        />

        {/* Board Title Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              onFetchAvailableBoards();
              setShowBoardDropdown((prev) => !prev);
            }}
            style={{
              background: showBoardDropdown ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              border: '1px solid transparent',
              borderRadius: 8,
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#f8fafc',
              cursor: 'pointer',
            }}
            title="Switch board or manage boards (Clean board, Templates, Save As)"
          >
            <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
              {boardTitle || boardName}
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>▾</span>
          </button>

          {showBoardDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                left: 0,
                width: 320,
                background: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: 12,
                boxShadow: '0 20px 48px rgba(0,0,0,0.65)',
                padding: 8,
                zIndex: 80,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Boards ({availableBoards.length})
                </span>
                <span style={{ fontSize: 10, color: '#64748b' }}>boards/</span>
              </div>

              <div
                style={{
                  maxHeight: 210,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {availableBoards.map((b) => (
                  <button
                    key={b.name}
                    onClick={() => {
                      setShowBoardDropdown(false);
                      onSwitchBoard(b.name);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background:
                        b.name === boardName ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                      color: b.name === boardName ? '#38bdf8' : '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: b.name === boardName ? 700 : 500,
                        }}
                      >
                        {b.title || b.name}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {b.name} · {b.nodeCount} objects
                      </div>
                    </div>
                    {b.name === boardName && (
                      <span
                        style={{
                          color: '#38bdf8',
                          fontSize: 13,
                          fontWeight: 700,
                          marginLeft: 6,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div
                style={{
                  height: 1,
                  background: 'rgba(255, 255, 255, 0.1)',
                  margin: '4px 0',
                }}
              />

              <button
                onClick={() => {
                  setShowBoardDropdown(false);
                  onStartCleanBoard();
                }}
                style={dropdownActionBtnStyle}
              >
                <span>✨</span>
                <span>Start Clean Board...</span>
              </button>
              <button
                onClick={() => {
                  setShowBoardDropdown(false);
                  onStartTemplate();
                }}
                style={dropdownActionBtnStyle}
              >
                <span>📋</span>
                <span>Start from Template...</span>
              </button>
              <button
                onClick={() => {
                  setShowBoardDropdown(false);
                  onDuplicateBoard();
                }}
                style={dropdownActionBtnStyle}
              >
                <span>💾</span>
                <span>Save Board As / Duplicate...</span>
              </button>
              <button
                onClick={() => {
                  setShowBoardDropdown(false);
                  onReloadBoard();
                }}
                style={dropdownActionBtnStyle}
              >
                <span>🔄</span>
                <span>Reload from Disk</span>
              </button>
            </div>
          )}
        </div>

        <span
          style={{
            fontSize: 10,
            background: 'rgba(56, 189, 248, 0.12)',
            color: '#38bdf8',
            padding: '2px 7px',
            borderRadius: 999,
            border: '1px solid rgba(56, 189, 248, 0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          v{boardVersion}
        </span>

        {(selectedCount > 0 || hasSectionScope) && (
          <button
            onClick={onClearScope}
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              color: '#fda4af',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: 6,
              padding: '2px 7px',
              fontSize: 11,
              cursor: 'pointer',
            }}
            title="Clear active region/section focus"
          >
            ✕ Clear Scope ({selectedCount})
          </button>
        )}
      </div>

      {/* Right: Zoom + View Options Menu + Mode + Panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Zoom Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.7)',
            borderRadius: 8,
            padding: '2px 4px',
          }}
        >
          <button
            onClick={onZoomOut}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: 13,
            }}
          >
            −
          </button>
          <span
            onClick={onZoomReset}
            title="Click to reset zoom"
            style={{
              fontSize: 11.5,
              color: '#e2e8f0',
              minWidth: 36,
              textAlign: 'center',
              cursor: onZoomReset ? 'pointer' : 'default',
            }}
          >
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: 13,
            }}
          >
            +
          </button>
        </div>

        {/* View Options Dropdown Toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowViewMenu((prev) => !prev)}
            style={{
              ...toolBtnStyle(showViewMenu, '#38bdf8'),
              padding: '5px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
            }}
            title="Configure canvas display, borders, resize handles, and metadata"
          >
            <span>👁️ View</span>
            <span style={{ fontSize: 9 }}>▾</span>
          </button>

          {showViewMenu && (
            <div
              style={{
                position: 'absolute',
                top: 36,
                right: 0,
                width: 250,
                background: 'rgba(15, 23, 42, 0.97)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 16px 36px rgba(0,0,0,0.6)',
                zIndex: 70,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Canvas Display Settings
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={showCardBorders}
                  onChange={(e) => {
                    onToggleCardBorders(e.target.checked);
                    try {
                      localStorage.setItem('scrappy_show_card_borders', String(e.target.checked));
                    } catch {}
                  }}
                />
                <span>Show Card Borders</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={showResizeHandles}
                  onChange={(e) => {
                    onToggleResizeHandles(e.target.checked);
                    try {
                      localStorage.setItem('scrappy_show_resize_handles', String(e.target.checked));
                    } catch {}
                  }}
                />
                <span>Show Corner Resize Squares</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={showNodeMetadata}
                  onChange={(e) => {
                    onToggleNodeMetadata(e.target.checked);
                    try {
                      localStorage.setItem('scrappy_show_node_metadata', String(e.target.checked));
                    } catch {}
                  }}
                />
                <span>Show Badges & File Paths</span>
              </label>

              <div
                style={{
                  width: '100%',
                  height: 1,
                  background: 'rgba(255,255,255,0.1)',
                }}
              />

              <div style={{ fontSize: 11, color: '#94a3b8' }}>Connector Line Style:</div>
              <select
                value={defaultEdgeStyle}
                onChange={(e) =>
                  onChangeDefaultEdgeStyle(e.target.value as 'solid' | 'dashed' | 'animated')
                }
                style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  padding: '4px 6px',
                  fontSize: 11,
                }}
              >
                <option value="solid">─ Solid (Persistent)</option>
                <option value="dashed">┄ Dashed</option>
                <option value="animated">⋯ Animated Flow</option>
              </select>
            </div>
          )}
        </div>

        {/* Build ICM Pipeline shortcut */}
        <button
          onClick={onOpenPipelineModal}
          style={{
            ...toolBtnStyle(true, '#10b981'),
            fontSize: 11,
            padding: '5px 9px',
          }}
          title="Compile whiteboard brainstorm / Scope Section into an ICM Pipeline (icm-architect)"
        >
          🏗️ Pipeline ({registeredPipelinesCount})
        </button>

        {/* Realtime Transport Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 7,
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 600,
            color: wsConnected ? '#10b981' : '#f43f5e',
            cursor: 'default',
          }}
          title={
            transportMode === 'federated'
              ? 'Hybrid Federation: Native WebSockets + Ably Cloud Pub/Sub'
              : transportMode === 'ably'
                ? 'Ably Realtime Cloud Transport'
                : 'Native WebSockets (Localhost/Tailscale/LAN)'
          }
        >
          <span>
            {wsConnected
              ? transportMode === 'federated'
                ? '🌐 Federated'
                : transportMode === 'ably'
                  ? '⚡ Ably'
                  : '🟢 Local WS'
              : '🔴 Offline'}
          </span>
        </div>

        {/* Collaborators Avatar Stack */}
        {collaborators.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
            {collaborators.map((c) => {
              const isFollowing = followingActorId === c.actorId;
              const initials =
                c.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || (c.role === 'agent' ? '🤖' : '👤');

              return (
                <button
                  key={c.actorId}
                  onClick={() => onToggleFollow && onToggleFollow(c.actorId)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: c.color || '#38bdf8',
                    color: '#0f172a',
                    fontWeight: 800,
                    fontSize: 10,
                    border: isFollowing ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: isFollowing ? `0 0 10px ${c.color}` : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  title={`${c.name} (${c.role})\n${isFollowing ? 'Click to stop following' : 'Click to follow camera'}`}
                >
                  {initials}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Following Banner */}
        {followingActorId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: '#38bdf822',
              border: '1px solid #38bdf8',
              borderRadius: 7,
              padding: '2px 8px',
              fontSize: 10,
              color: '#38bdf8',
              fontWeight: 700,
            }}
          >
            <span>👁️ Following</span>
            <button
              onClick={onStopFollow}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                fontWeight: 800,
                padding: '0 2px',
                fontSize: 11,
              }}
              title="Stop following"
            >
              ✕
            </button>
          </div>
        )}

        {/* Current User Profile Pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowIdentityPopover(!showIdentityPopover)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 7,
              padding: '3px 8px',
              color: '#f8fafc',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Click to customize your display name & avatar color"
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: currentUser?.color || '#38bdf8',
              }}
            />
            <span>{currentUser?.name || 'You'}</span>
          </button>

          {showIdentityPopover && (
            <div
              style={{
                position: 'absolute',
                top: 36,
                right: 0,
                width: 220,
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: 12,
                boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>
                COLLABORATOR IDENTITY
              </div>
              <input
                type="text"
                value={currentUser?.name || ''}
                onChange={(e) => onUpdateIdentity && onUpdateIdentity({ name: e.target.value })}
                placeholder="Display Name"
                style={{
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Avatar & Cursor Color:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {USER_PALETTES.map((p) => (
                  <button
                    key={p.hex}
                    onClick={() => onUpdateIdentity && onUpdateIdentity({ color: p.hex })}
                    style={{
                      height: 22,
                      borderRadius: 6,
                      background: p.hex,
                      border: currentUser?.color === p.hex ? '2px solid #ffffff' : 'none',
                      cursor: 'pointer',
                    }}
                    title={p.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Share & Security Button */}
        {onOpenShareModal && (
          <button
            onClick={onOpenShareModal}
            style={{
              ...toolBtnStyle(true, isPasscodeProtected ? '#f59e0b' : '#38bdf8'),
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Share board link & configure passcode security"
          >
            <span>{isPasscodeProtected ? '🔒' : '👥'} Share</span>
          </button>
        )}

        {/* Mode Switcher */}
        <button
          onClick={onTogglePromptMode}
          style={{
            ...toolBtnStyle(true, promptMode === 'icm' ? '#a855f7' : '#38bdf8'),
            fontSize: 11,
          }}
          title="Toggle between ICM Mode (/update-scrappy) and Standalone Model API"
        >
          {promptMode === 'icm' ? '📂 ICM' : '☁️ API'}
        </button>

        {/* Collapsible Panel Toggle */}
        <button
          onClick={onToggleDrawer}
          style={{ ...toolBtnStyle(drawerOpen, '#a855f7'), fontSize: 11 }}
          title="Toggle Agent & ICM Panel"
        >
          {drawerOpen ? '▸ Hide' : `◂ Panel (${pendingPromptsCount})`}
        </button>
      </div>
    </div>
  );
}
