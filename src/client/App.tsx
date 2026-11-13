import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CanvasEdge,
  CanvasNode,
  ChecklistItem,
  NodeType,
  PromptExecutionRoute,
  RegisteredICMPipeline,
  SectionNode,
  TableData,
} from '../core/types.js';
import { formatTableToMarkdown } from '../core/index.js';
import {
  CARD_COLORS,
  ContextDialogState,
  DrawerTab,
  EditingEdgeState,
  ViewportState,
} from './types.js';
import { findNearestAvailablePosition } from './utils/geometry.js';

// Custom State & Interaction Hooks
import { useBoardState } from './hooks/useBoardState.js';
import { useRealtimeSocket } from './hooks/useRealtimeSocket.js';
import { useViewport } from './hooks/useViewport.js';
import { useCanvasInteractions } from './hooks/useCanvasInteractions.js';
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts.js';

// Shell & Canvas Components
import { TopBar } from './components/shell/TopBar.js';
import { BottomDock } from './components/shell/BottomDock.js';
import { GlassBoxDrawer } from './components/shell/GlassBoxDrawer.js';
import { CanvasViewport } from './components/canvas/CanvasViewport.js';
import { SectionLayer } from './components/canvas/SectionLayer.js';
import { EdgeLayer } from './components/canvas/EdgeLayer.js';
import { NodeLayer } from './components/canvas/NodeLayer.js';
import { SelectionLayer } from './components/canvas/SelectionLayer.js';
import { PresenceLayer } from './components/canvas/PresenceLayer.js';

// Overlays & Modals
import { ConnectorInspector } from './components/overlays/ConnectorInspector.js';
import { ScrappyContextDialog } from './components/overlays/ScrappyContextDialog.js';
import {
  DuplicateBoardModal,
  EditNodeModal,
  NewBoardModal,
  PipelineStudioModal,
  ShareSecurityModal,
  PasscodePromptModal,
} from './components/overlays/Modals.js';

/**
 * Scrappy Whiteboard Root Application Component.
 *
 * Architecture Map:
 * 1. Hooks:
 *    - `useBoardState`: Board document lifecycle, optimistic local mutations, REST sync.
 *    - `useRealtimeSocket`: WebSocket delta sync (`op.delta`), peer presence, instant leave.
 *    - `useViewport`: Infinite pan/zoom math, screen-to-board transforms, HTML5 canvas dot grid.
 *    - `useCanvasInteractions`: Dragging, corner resizing, connection drawing, and region selection.
 *    - `useCanvasShortcuts`: Keyboard hotkeys (Delete, Esc, 1/2, Cmd+K) and image/Mermaid clipboard paste.
 *
 * 2. Visual Layers:
 *    - Shell: `TopBar`, `BottomDock`, `GlassBoxDrawer`
 *    - Canvas Layers: `SectionLayer`, `EdgeLayer`, `NodeLayer`, `SelectionLayer`, `PresenceLayer`
 *    - Overlays: `ConnectorInspector`, `ScrappyContextDialog`, `Modals`
 */
export function App() {
  // ---------------------------------------------------------------------------
  // 1. Board & Realtime State
  // ---------------------------------------------------------------------------
  const {
    board,
    setBoard,
    boardName,
    availableBoards,
    switchBoard,
    fetchAvailableBoards,
    fetchBoard,
    sendOps,
    applyDeltaLocally,
  } = useBoardState();

  // ---------------------------------------------------------------------------
  // 2. Shell & Display Preferences
  // ---------------------------------------------------------------------------
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('agy');
  const [inspectedFilePath, setInspectedFilePath] = useState<string>('_prompts/ACTIVE_PROMPT.md');
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(`scrappy_token_${boardName}`) || '';
    } catch {
      return '';
    }
  });

  const [showCardBorders, setShowCardBorders] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scrappy_show_card_borders') === 'true';
    } catch {
      return false;
    }
  });
  const [showResizeHandles, setShowResizeHandles] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scrappy_show_resize_handles') === 'true';
    } catch {
      return false;
    }
  });
  const [showNodeMetadata, setShowNodeMetadata] = useState<boolean>(() => {
    try {
      return localStorage.getItem('scrappy_show_node_metadata') === 'true';
    } catch {
      return false;
    }
  });

  const [defaultEdgeStyle, setDefaultEdgeStyle] = useState<'solid' | 'dashed' | 'animated'>('solid');
  const [showQuickPromptBar, setShowQuickPromptBar] = useState(false);

  // ---------------------------------------------------------------------------
  // 3. Viewport & Canvas Interactions
  // ---------------------------------------------------------------------------
  const {
    viewport,
    setViewport,
    activeTool,
    setActiveTool,
    isPanning,
    setIsPanning,
    containerRef,
    canvasBgRef,
    panStartRef,
    lastPanPosRef,
    screenToBoard,
    focusOnBounds,
    fitContent,
    handleWheel,
    zoomIn,
    zoomOut,
    zoomReset,
  } = useViewport(drawerOpen);

  const handleFollowUpdate = useCallback(
    (cursor: { x: number; y: number }, targetViewport?: ViewportState) => {
      if (targetViewport) {
        setViewport(targetViewport);
      } else {
        const container = containerRef.current;
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;
        setViewport((prev) => ({
          ...prev,
          x: Math.round(width / 2 - cursor.x * prev.zoom),
          y: Math.round(height / 2 - cursor.y * prev.zoom),
        }));
      }
    },
    [containerRef, setViewport]
  );

  const handleBoardSync = useCallback(
    (syncedBoard: typeof board) => {
      setBoard(syncedBoard);
      if (syncedBoard?.security?.mode === 'passcode' && !authToken) {
        setIsLocked(true);
      }
    },
    [setBoard, authToken]
  );

  const {
    wsConnected,
    transportMode,
    collaborators,
    activityLog,
    broadcastCursor,
    identity,
    setIdentity,
    followingActorId,
    startFollowing,
    stopFollowing,
  } = useRealtimeSocket({
    boardName,
    onBoardSync: handleBoardSync,
    onDeltaSync: applyDeltaLocally,
    onFollowUpdate: handleFollowUpdate,
    authToken,
  });

  // Check if board requires passcode on mount / switch
  useEffect(() => {
    if (board?.security?.mode === 'passcode' && !authToken) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [board?.security?.mode, authToken]);

  const handleUnlockBoard = async (passcode: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardName, passcode, actorId: identity.actorId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.token);
        try {
          sessionStorage.setItem(`scrappy_token_${boardName}`, data.token);
        } catch {}
        setIsLocked(false);
        await fetchBoard();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleUpdateSecurity = async (mode: 'public' | 'passcode', passcode?: string) => {
    const res = await fetch(`/api/v1/boards/${boardName}/security`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, passcode }),
    });
    if (res.ok) {
      await fetchBoard();
    }
  };

  const [editingEdge, setEditingEdge] = useState<EditingEdgeState | null>(null);
  const [contextDialog, setContextDialog] = useState<ContextDialogState | null>(null);

  const dismissPopups = useCallback(() => {
    setContextDialog(null);
    setEditingEdge(null);
  }, []);

  const {
    draggingNode,
    resizingNode,
    draggingSection,
    resizingSection,
    connectingFrom,
    regionDrag,
    startDragNode,
    startResizeNode,
    startDragSection,
    startResizeSection,
    startConnecting,
    cancelConnecting,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  } = useCanvasInteractions({
    viewport,
    setViewport,
    screenToBoard,
    board,
    setBoard,
    activeTool,
    sendOps,
    broadcastCursor,
    isPanning,
    setIsPanning,
    panStartRef,
    lastPanPosRef,
    onDismissPopups: dismissPopups,
  });

  // ---------------------------------------------------------------------------
  // 4. Overlays & Modals State
  // ---------------------------------------------------------------------------
  const [editingNode, setEditingNode] = useState<CanvasNode | null>(null);
  const [inspectingJsonNodeId, setInspectingJsonNodeId] = useState<string | null>(null);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [pipelineTargetSectionId, setPipelineTargetSectionId] = useState<string | undefined>(undefined);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Prompt Dialog State
  const [promptText, setPromptText] = useState('@scrappy ');
  const [promptMode, setPromptMode] = useState<'icm' | 'standalone_api'>('icm');
  const [executionRoute, setExecutionRoute] = useState<PromptExecutionRoute>('adhoc');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [apiProvider, setApiProvider] = useState<'gemini' | 'anthropic' | 'openai'>('gemini');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);
  const promptInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus prompt input when dialog pops up
  useEffect(() => {
    if (contextDialog || showQuickPromptBar) {
      setTimeout(() => promptInputRef.current?.focus(), 25);
    }
  }, [contextDialog, showQuickPromptBar]);

  // ---------------------------------------------------------------------------
  // 5. ICM Pipelines Matching (`CONTEXT.md`)
  // ---------------------------------------------------------------------------
  const registeredPipelines: RegisteredICMPipeline[] = board?.icmWorkspace?.pipelines || [];

  const matchedPipelines = useMemo(() => {
    const clean = promptText.toLowerCase().replace(/^@scrappy\b[:\s,-]*/i, '').trim();
    if (!clean) return [];
    const scored: Array<{ pipeline: RegisteredICMPipeline; score: number }> = [];
    for (const pipe of registeredPipelines) {
      let score = 0;
      if (clean.includes(pipe.id.toLowerCase())) score += 5;
      for (const t of pipe.triggerIntents) {
        const kw = t.toLowerCase();
        if (clean.includes(kw)) score += kw.length >= 5 ? 3 : 2;
      }
      if (score > 0) scored.push({ pipeline: pipe, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.pipeline);
  }, [promptText, registeredPipelines]);

  useEffect(() => {
    if (matchedPipelines.length > 0) {
      setSelectedPipelineId(matchedPipelines[0].id);
      setExecutionRoute('pipeline');
    }
  }, [matchedPipelines]);

  // ---------------------------------------------------------------------------
  // 6. Action Handlers
  // ---------------------------------------------------------------------------
  const findSectionAt = useCallback(
    (bx: number, by: number): SectionNode | undefined => {
      if (!board) return undefined;
      for (const sec of Object.values(board.sections)) {
        const b = sec.bounds;
        if (bx >= b.x && bx <= b.x + b.width && by >= b.y && by <= b.y + b.height) {
          return sec;
        }
      }
      return undefined;
    },
    [board]
  );

  const openScrappyContextMenu = useCallback(
    (e: React.MouseEvent, targetNodeId?: string, explicitSectionId?: string) => {
      e.preventDefault();
      e.stopPropagation();
      dismissPopups();

      const pt = screenToBoard(e.clientX, e.clientY);
      const detectedSection =
        explicitSectionId ||
        (targetNodeId && board?.nodes[targetNodeId]?.sectionId) ||
        board?.activeSelection.sectionId ||
        findSectionAt(pt.x, pt.y)?.id;

      const maxScreenX = (drawerOpen ? window.innerWidth - 400 : window.innerWidth) - 440;
      const maxScreenY = window.innerHeight - 240;

      setContextDialog({
        screenX: Math.max(16, Math.min(e.clientX + 8, maxScreenX)),
        screenY: Math.max(70, Math.min(e.clientY + 8, maxScreenY)),
        boardX: Math.round(pt.x),
        boardY: Math.round(pt.y),
        targetNodeId,
        targetSectionId: detectedSection,
      });
      setPromptText((prev) => (prev.trim().startsWith('@scrappy') ? prev : '@scrappy '));
    },
    [board, dismissPopups, drawerOpen, findSectionAt, screenToBoard]
  );

  const handleSubmitScrappyPrompt = useCallback(
    async (
      overrideText?: string,
      overrideTarget?: {
        boardX?: number;
        boardY?: number;
        targetNodeId?: string;
        targetSectionId?: string;
      }
    ) => {
      const raw = (overrideText ?? promptText).trim();
      const cleaned = raw.replace(/^@scrappy\s*$/i, '').trim();
      if (!cleaned || !board) return;

      const finalPrompt = raw.toLowerCase().startsWith('@scrappy') ? raw : `@scrappy ${raw}`;
      const anchorPosition = {
        x: overrideTarget?.boardX ?? contextDialog?.boardX ?? 400,
        y: overrideTarget?.boardY ?? contextDialog?.boardY ?? 260,
      };

      const targetNodeId = overrideTarget?.targetNodeId ?? contextDialog?.targetNodeId;
      const selectedNodeIds =
        board.activeSelection.nodeIds.length > 0
          ? board.activeSelection.nodeIds
          : targetNodeId
          ? [targetNodeId]
          : [];

      const selectedSectionId =
        overrideTarget?.targetSectionId ||
        contextDialog?.targetSectionId ||
        board.activeSelection.sectionId;

      try {
        const res = await fetch(`/api/v1/boards/${boardName}/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: finalPrompt,
            mode: promptMode,
            executionRoute,
            selectedPipelineId:
              executionRoute === 'pipeline' && selectedPipelineId ? selectedPipelineId : undefined,
            anchorPosition,
            targetNodeId,
            selectedNodeIds,
            selectedSectionId,
            boundingBox: board.activeSelection.boundingBox,
            apiConfig: apiKeyInput ? { provider: apiProvider, apiKey: apiKeyInput } : undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setBoard(data.board);
          setPromptText('@scrappy ');
          setContextDialog(null);
          setShowQuickPromptBar(false);
          if (promptMode === 'icm') {
            setDrawerOpen(true);
            setDrawerTab('agy');
            setInspectedFilePath('_prompts/ACTIVE_PROMPT.md');
          }
        }
      } catch (err) {
        console.error('Failed to submit prompt to @scrappy:', err);
      }
    },
    [
      apiKeyInput,
      apiProvider,
      board,
      boardName,
      contextDialog,
      executionRoute,
      promptMode,
      promptText,
      selectedPipelineId,
      setBoard,
    ]
  );

  const toggleDictation = useCallback(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Browser SpeechRecognition API not supported in this browser.');
      return;
    }
    if (isDictating && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsDictating(false);
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setPromptText((prev) => {
          const base = prev.trim().startsWith('@scrappy') ? prev.trim() : `@scrappy ${prev.trim()}`;
          return `${base} ${transcript}`;
        });
      }
    };
    rec.onend = () => setIsDictating(false);
    rec.onerror = () => setIsDictating(false);
    recognitionRef.current = rec;
    setIsDictating(true);
    rec.start();
  }, [isDictating]);

  const handleAddNode = useCallback(
    async (type: 'sticky' | 'shape' | 'checklist' | 'mermaid' | 'image' | 'table' | 'text') => {
      if (!board) return;
      const container = containerRef.current;
      const screenW = container?.clientWidth || window.innerWidth;
      const screenH = container?.clientHeight || window.innerHeight;
      const center = screenToBoard(screenW * 0.45, screenH * 0.45);
      const pos = { x: Math.round(center.x), y: Math.round(center.y) };

      if (type === 'text') {
        const size = { width: 300, height: 80 };
        await sendOps([
          {
            op: 'create_node',
            node: {
              type: 'text',
              position: pos,
              size,
              content: { title: '', body: 'Double-click to type text...' },
              style: { color: '#f8fafc', shape: 'rect' },
            },
          },
        ]);
        focusOnBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
        return;
      }

      if (type === 'table') {
        const size = { width: 440, height: 280 };
        const defaultTable: TableData = {
          columns: ['Feature / Milestone', 'Status', 'Owner', 'Priority'],
          rows: [
            ['Markdown Support', 'Done', 'Alex', 'High'],
            ['Visual Grid Creation', 'Done', 'Jordan', 'High'],
            ['Natural Language CSS Styler', 'Ready', 'Sam', 'Medium'],
          ],
          stylePreset: 'default',
          customStyleDescription: 'board theme with subtle borders',
        };
        await sendOps([
          {
            op: 'create_node',
            node: {
              type: 'table',
              position: pos,
              size,
              content: {
                title: 'Interactive Table',
                body: formatTableToMarkdown(defaultTable),
                tableData: defaultTable,
                tags: ['table', 'ui-library'],
              },
              style: { color: '#0f172a', shape: 'rect' },
            },
          },
        ]);
        focusOnBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
        return;
      }

      if (type === 'checklist') {
        const size = { width: 295, height: 225 };
        const items: ChecklistItem[] = [
          { id: 'bug-1', text: 'Example bug / task 1', checked: false },
          { id: 'bug-2', text: 'Example bug / task 2', checked: false },
        ];
        await sendOps([
          {
            op: 'create_node',
            node: {
              type: 'checklist',
              position: pos,
              size,
              content: {
                title: 'Bug & Task Checklist',
                body: '',
                checklistItems: items,
                tags: ['checklist'],
              },
              style: { color: '#fef08a', shape: 'rect' },
            },
          },
        ]);
        focusOnBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
        return;
      }

      if (type === 'mermaid') {
        const size = { width: 380, height: 245 };
        const mermaidCode = `flowchart LR\n  A["User Input"] --> B["@scrappy"]\n  B --> C["Live Canvas"]`;
        await sendOps([
          {
            op: 'create_node',
            node: {
              type: 'mermaid',
              position: pos,
              size,
              content: {
                title: 'Mermaid Diagram',
                body: '```mermaid\n' + mermaidCode + '\n```',
                mermaidCode,
                tags: ['mermaid'],
              },
              style: { color: '#0f172a', shape: 'rect' },
            },
          },
        ]);
        focusOnBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
        return;
      }

      if (type === 'image') {
        const size = { width: 320, height: 230 };
        await sendOps([
          {
            op: 'create_node',
            node: {
              type: 'image',
              position: pos,
              size,
              content: { title: 'Image Card', body: 'Upload or paste an image (Cmd+V)' },
              style: { color: '#0f172a', shape: 'rect' },
            },
          },
        ]);
        focusOnBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
        return;
      }

      const size = { width: 250, height: 150 };
      const color =
        type === 'sticky'
          ? CARD_COLORS[Object.keys(board.nodes).length % CARD_COLORS.length].hex
          : '#c7d2fe';
      await sendOps([
        {
          op: 'create_node',
          node: {
            type,
            position: pos,
            size,
            content: {
              title: type === 'sticky' ? 'New Sticky Note' : 'Process Step',
              body: 'Double-click to edit, drag corners to resize, or right-click to summon @scrappy.',
            },
            style: { color, shape: type === 'shape' ? 'pill' : 'rect' },
          },
        },
      ]);
      focusOnBounds({ x: pos.x, y: pos.y, width: size.width, height: size.height });
    },
    [board, containerRef, focusOnBounds, screenToBoard, sendOps]
  );

  const handleAddSection = useCallback(async () => {
    if (!board) return;
    const count = Object.keys(board.sections).length + 1;

    // 1. Calculate the user's visible viewport center in board coordinates
    const container = containerRef.current;
    const screenW = container?.clientWidth || window.innerWidth;
    const screenH = container?.clientHeight || window.innerHeight;
    const center = screenToBoard(screenW / 2, screenH / 2);

    // 2. Find nearest available non-overlapping position relative to user view
    const sectionW = 600;
    const sectionH = 500;
    const existingBounds = Object.values(board.sections).map((s) => s.bounds);
    const bestBounds = findNearestAvailablePosition(center, sectionW, sectionH, existingBounds, 40);

    // 3. Dispatch create_section with calculated bounds
    await sendOps([
      {
        op: 'create_section',
        section: {
          title: `0${count}. New ICM Stage`,
          description: 'Drag header to move or drag corners to resize (scales locked cards).',
          color: '#38bdf8',
          bounds: bestBounds,
        },
      },
    ]);

    // 4. Smoothly focus canvas view directly on the newly created scope section
    focusOnBounds(bestBounds);
  }, [board, containerRef, focusOnBounds, screenToBoard, sendOps]);

  const handleBuildIcmPipeline = useCallback(
    async (opts: {
      title: string;
      triggerIntents: string[];
      sectionId?: string;
      outputType: NodeType;
    }) => {
      if (!board) return;
      const res = await fetch(`/api/v1/boards/${boardName}/icm/build-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: opts.title,
          triggerIntents: opts.triggerIntents,
          sectionId: opts.sectionId || board.activeSelection.sectionId,
          nodeIds:
            board.activeSelection.nodeIds.length > 0
              ? board.activeSelection.nodeIds
              : undefined,
          outputWidgetType: opts.outputType,
          reflectOnCanvas: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
        setShowPipelineModal(false);
      }
    },
    [board, boardName, setBoard]
  );

  // ---------------------------------------------------------------------------
  // 7. Global Shortcuts & Clipboard Paste
  // ---------------------------------------------------------------------------
  const getCenterCoordinates = useCallback(
    () => screenToBoard(window.innerWidth * 0.42, window.innerHeight * 0.42),
    [screenToBoard]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!board) return;
    if (editingEdge) {
      await sendOps([{ op: 'delete_edge', id: editingEdge.id }]);
      setEditingEdge(null);
      return;
    }
    const ops = board.activeSelection.nodeIds.map((id) => ({
      op: 'delete_node' as const,
      id,
    }));
    if (ops.length > 0) {
      await sendOps(ops);
    }
  }, [board, editingEdge, sendOps]);

  const handleClearSelection = useCallback(() => {
    dismissPopups();
    if (board && (board.activeSelection.nodeIds.length > 0 || board.activeSelection.sectionId)) {
      sendOps([{ op: 'set_selection', nodeIds: [], sectionId: undefined, boundingBox: undefined }]);
    }
  }, [board, dismissPopups, sendOps]);

  const handlePasteImage = useCallback(
    async (imageUrl: string, bx: number, by: number) => {
      await sendOps([
        {
          op: 'create_node',
          node: {
            type: 'image',
            position: { x: Math.round(bx), y: Math.round(by) },
            size: { width: 340, height: 240 },
            content: { title: 'Pasted Image', body: '', imageUrl },
            style: { color: '#0f172a', shape: 'rect' },
          },
        },
      ]);
    },
    [sendOps]
  );

  const handlePasteMermaid = useCallback(
    async (mermaidCode: string, bx: number, by: number) => {
      await sendOps([
        {
          op: 'create_node',
          node: {
            type: 'mermaid',
            position: { x: Math.round(bx), y: Math.round(by) },
            size: { width: 380, height: 250 },
            content: {
              title: 'Pasted Mermaid Diagram',
              body: '```mermaid\n' + mermaidCode + '\n```',
              mermaidCode,
            },
            style: { color: '#0f172a', shape: 'rect' },
          },
        },
      ]);
    },
    [sendOps]
  );

  useCanvasShortcuts({
    activeTool,
    setActiveTool,
    selectedNodeIds: board?.activeSelection.nodeIds || [],
    editingEdgeId: editingEdge?.id,
    onDeleteSelected: handleDeleteSelected,
    onClearSelection: handleClearSelection,
    onToggleQuickPrompt: () => setShowQuickPromptBar((prev) => !prev),
    onPasteImage: handlePasteImage,
    onPasteMermaid: handlePasteMermaid,
    getCenterCoordinates,
  });

  // ---------------------------------------------------------------------------
  // 8. Render Loading or Canvas Orchestrator
  // ---------------------------------------------------------------------------
  if (!board) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          background: '#0b1120',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Loading Scrappy Whiteboard...
      </div>
    );
  }

  const selectedCount = board.activeSelection.nodeIds.length;
  const pendingPrompts = board.prompts.filter((p) => p.status === 'pending');

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0b1120',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* 1. Minimalist Top Bar */}
      <TopBar
        boardName={boardName}
        boardTitle={board.title}
        boardVersion={board.version}
        wsConnected={wsConnected}
        availableBoards={availableBoards}
        onSwitchBoard={switchBoard}
        onFetchAvailableBoards={fetchAvailableBoards}
        onStartCleanBoard={() => setShowNewBoardModal(true)}
        onStartTemplate={() => setShowNewBoardModal(true)}
        onDuplicateBoard={() => setShowDuplicateModal(true)}
        onReloadBoard={async () => {
          await fetch(`/api/v1/boards/${boardName}/reload`, { method: 'POST' });
          await fetchBoard();
        }}
        selectedCount={selectedCount}
        hasSectionScope={Boolean(board.activeSelection.sectionId)}
        onClearScope={() =>
          sendOps([{ op: 'set_selection', nodeIds: [], sectionId: undefined, boundingBox: undefined }])
        }
        viewport={viewport}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((o) => !o)}
        showCardBorders={showCardBorders}
        onToggleCardBorders={setShowCardBorders}
        showResizeHandles={showResizeHandles}
        onToggleResizeHandles={setShowResizeHandles}
        showNodeMetadata={showNodeMetadata}
        onToggleNodeMetadata={setShowNodeMetadata}
        defaultEdgeStyle={defaultEdgeStyle}
        onChangeDefaultEdgeStyle={setDefaultEdgeStyle}
        registeredPipelinesCount={registeredPipelines.length}
        onOpenPipelineModal={() => {
          setPipelineTargetSectionId(board.activeSelection.sectionId);
          setShowPipelineModal(true);
        }}
        promptMode={promptMode}
        onTogglePromptMode={() => setPromptMode((m) => (m === 'icm' ? 'standalone_api' : 'icm'))}
        pendingPromptsCount={pendingPrompts.length}
        collaborators={collaborators}
        currentUser={identity}
        onUpdateIdentity={setIdentity}
        followingActorId={followingActorId}
        onToggleFollow={(id) => {
          if (followingActorId === id) stopFollowing();
          else startFollowing(id);
        }}
        onStopFollow={stopFollowing}
        transportMode={transportMode}
        onOpenShareModal={() => setShowShareModal(true)}
        isPasscodeProtected={board.security?.mode === 'passcode'}
      />

      {/* 2. Main Infinite Canvas Viewport */}
      <CanvasViewport
        containerRef={containerRef}
        canvasBgRef={canvasBgRef}
        viewport={viewport}
        activeTool={activeTool}
        isPanning={isPanning}
        onContextMenu={(e) => openScrappyContextMenu(e)}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onWheel={handleWheel}
      >
        {/* Layer 1: Scope Sections */}
        <SectionLayer
          board={board}
          showResizeHandles={showResizeHandles}
          showNodeMetadata={showNodeMetadata}
          onStartResizeSection={startResizeSection}
          onStartDragSection={startDragSection}
          onOpenScrappyContextMenu={openScrappyContextMenu}
          onOpenPipelineForSection={(sec) => {
            setPipelineTargetSectionId(sec.id);
            setShowPipelineModal(true);
          }}
          onScopeSection={(sec) => {
            const secNodeIds = Object.values(board.nodes)
              .filter((n) => n.sectionId === sec.id)
              .map((n) => n.id);
            sendOps([
              {
                op: 'set_selection',
                nodeIds: secNodeIds,
                sectionId: sec.id,
                boundingBox: sec.bounds,
              },
            ]);
          }}
          onDeleteSection={(sectionId) => sendOps([{ op: 'delete_section', id: sectionId }])}
        />

        {/* Layer 2: Directed SVG Connectors */}
        <EdgeLayer
          board={board}
          editingEdgeId={editingEdge?.id}
          connectingFrom={connectingFrom}
          defaultEdgeStyle={defaultEdgeStyle}
          onOpenEdgeInspector={(edge, e) => {
            e.stopPropagation();
            setEditingEdge({
              id: edge.id,
              label: edge.label || '',
              style: edge.style || 'solid',
              screenX: Math.min(window.innerWidth - 320, Math.max(20, e.clientX)),
              screenY: Math.min(window.innerHeight - 200, Math.max(70, e.clientY)),
            });
          }}
        />

        {/* Layer 3: Interactive Cards & Widgets */}
        <NodeLayer
          board={board}
          showCardBorders={showCardBorders}
          showResizeHandles={showResizeHandles}
          showNodeMetadata={showNodeMetadata}
          defaultEdgeStyle={defaultEdgeStyle}
          isPanning={isPanning}
          connectingFrom={connectingFrom}
          onStartDragNode={startDragNode}
          onStartResizeNode={startResizeNode}
          onStartConnecting={startConnecting}
          onCompleteConnecting={(toNodeId) => {
            if (connectingFrom) {
              sendOps([
                {
                  op: 'create_edge',
                  edge: {
                    fromNodeId: connectingFrom.nodeId,
                    toNodeId,
                    label: defaultEdgeStyle === 'solid' ? 'persisted' : 'connects',
                    style: defaultEdgeStyle,
                    directed: true,
                  },
                },
              ]);
              cancelConnecting();
            }
          }}
          onOpenScrappyContextMenu={openScrappyContextMenu}
          onOpenEditModal={(node) => setEditingNode(node)}
          onInspectJson={(nodeId) =>
            setInspectingJsonNodeId((prev) => (prev === nodeId ? null : nodeId))
          }
          inspectingJsonNodeId={inspectingJsonNodeId}
          onOpenIcmFile={(filePath) => {
            setInspectedFilePath(filePath);
            setDrawerOpen(true);
            setDrawerTab('icm');
          }}
          sendOps={sendOps}
          onSubmitScrappyPrompt={handleSubmitScrappyPrompt}
        />

        {/* Layer 4: Selection & Prompt Overlays */}
        <SelectionLayer
          pendingPrompts={pendingPrompts}
          activeBoundingBox={board.activeSelection.boundingBox}
          regionDrag={regionDrag}
          onOpenDrawerToPrompts={() => {
            setDrawerOpen(true);
            setDrawerTab('agy');
          }}
        />

        {/* Layer 5: Peer Collaborators & Agent Presence */}
        <PresenceLayer collaborators={collaborators} />
      </CanvasViewport>

      {/* 3. Floating Bottom Tool Dock */}
      <BottomDock
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        onAddNode={handleAddNode}
        onAddSection={handleAddSection}
        showQuickPromptBar={showQuickPromptBar}
        setShowQuickPromptBar={setShowQuickPromptBar}
        promptText={promptText}
        setPromptText={setPromptText}
        onSubmitPrompt={handleSubmitScrappyPrompt}
        isDictating={isDictating}
        onToggleDictation={toggleDictation}
        promptInputRef={promptInputRef}
      />

      {/* 4. Glass-Box Inspector Drawer */}
      <GlassBoxDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        boardName={boardName}
        prompts={board.prompts}
        activityLog={activityLog}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        inspectedFilePath={inspectedFilePath}
      />

      {/* 5. Floating Overlays */}
      <ConnectorInspector
        editingEdge={editingEdge}
        onClose={() => setEditingEdge(null)}
        onUpdateEdge={async (id, label, style) => {
          await sendOps([{ op: 'update_edge', id, patch: { label, style } }]);
        }}
        onDeleteEdge={async (id) => {
          await sendOps([{ op: 'delete_edge', id }]);
        }}
      />

      <ScrappyContextDialog
        contextDialog={contextDialog}
        board={board}
        selectedCount={selectedCount}
        promptText={promptText}
        setPromptText={setPromptText}
        isDictating={isDictating}
        toggleDictation={toggleDictation}
        promptMode={promptMode}
        setPromptMode={setPromptMode}
        executionRoute={executionRoute}
        setExecutionRoute={setExecutionRoute}
        selectedPipelineId={selectedPipelineId}
        setSelectedPipelineId={setSelectedPipelineId}
        matchedPipelines={matchedPipelines}
        registeredPipelines={registeredPipelines}
        apiProvider={apiProvider}
        setApiProvider={setApiProvider}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        showApiConfig={showApiConfig}
        setShowApiConfig={setShowApiConfig}
        promptInputRef={promptInputRef}
        onClose={() => setContextDialog(null)}
        onSubmitPrompt={handleSubmitScrappyPrompt}
      />

      {/* 6. Modals */}
      <EditNodeModal
        node={editingNode}
        onClose={() => setEditingNode(null)}
        onSave={async (id, title, body, color) => {
          await sendOps([
            {
              op: 'update_node',
              id,
              patch: {
                content: { title, body },
                style: { color },
              },
            },
          ]);
        }}
      />

      <PipelineStudioModal
        isOpen={showPipelineModal}
        onClose={() => setShowPipelineModal(false)}
        board={board}
        targetSectionId={pipelineTargetSectionId}
        selectedCount={selectedCount}
        registeredPipelines={registeredPipelines}
        onBuildPipeline={handleBuildIcmPipeline}
        onInspectPipelineIcm={(routingPath) => {
          setShowPipelineModal(false);
          setInspectedFilePath(routingPath);
          setDrawerOpen(true);
          setDrawerTab('icm');
        }}
      />

      <NewBoardModal
        isOpen={showNewBoardModal}
        onClose={() => setShowNewBoardModal(false)}
        onCreateBoard={async (slug, title, template) => {
          const res = await fetch('/api/v1/boards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: slug, title, template }),
          });
          if (res.ok) {
            await fetchAvailableBoards();
            switchBoard(slug);
          }
        }}
      />

      <DuplicateBoardModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        currentBoardName={boardName}
        currentBoardTitle={board.title}
        onDuplicateBoard={async (targetSlug, title) => {
          const res = await fetch(`/api/v1/boards/${boardName}/duplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetName: targetSlug, title }),
          });
          if (res.ok) {
            await fetchAvailableBoards();
            switchBoard(targetSlug);
          }
        }}
      />

      <ShareSecurityModal
        isOpen={showShareModal}
        boardName={boardName}
        securityMode={board.security?.mode || 'public'}
        hasPasscode={Boolean(board.security?.passcodeHash)}
        onClose={() => setShowShareModal(false)}
        onUpdateSecurity={handleUpdateSecurity}
      />

      <PasscodePromptModal
        isOpen={isLocked}
        boardName={boardName}
        onSubmit={handleUnlockBoard}
      />
    </div>
  );
}
