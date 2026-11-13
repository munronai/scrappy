import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BoundingBox, BoardDocument, GraphOp } from '../../core/types.js';
import {
  ActiveTool,
  ConnectingState,
  DragNodeState,
  DragSectionState,
  RegionDragState,
  ResizeCorner,
  ResizeNodeState,
  ResizeSectionState,
  ViewportState,
} from '../types.js';
import { computeResizedBounds } from '../utils/geometry.js';

interface UseCanvasInteractionsProps {
  viewport: ViewportState;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  screenToBoard: (clientX: number, clientY: number) => { x: number; y: number };
  board: BoardDocument | null;
  setBoard: React.Dispatch<React.SetStateAction<BoardDocument | null>>;
  activeTool: ActiveTool;
  sendOps: (ops: GraphOp[]) => Promise<void>;
  broadcastCursor: (boardX: number, boardY: number, activeNodeId?: string) => void;
  isPanning: boolean;
  setIsPanning: (panning: boolean) => void;
  panStartRef: React.MutableRefObject<{ x: number; y: number; vx: number; vy: number } | null>;
  lastPanPosRef?: React.MutableRefObject<{ x: number; y: number } | null>;
  onDismissPopups: () => void;
}

export function useCanvasInteractions({
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
  onDismissPopups,
}: UseCanvasInteractionsProps) {
  const [draggingNode, setDraggingNode] = useState<DragNodeState | null>(null);
  const [resizingNode, setResizingNode] = useState<ResizeNodeState | null>(null);
  const [draggingSection, setDraggingSection] = useState<DragSectionState | null>(null);
  const [resizingSection, setResizingSection] = useState<ResizeSectionState | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<ConnectingState | null>(null);
  const [regionDrag, setRegionDrag] = useState<RegionDragState | null>(null);

  // Local ref fallback if not passed in from useViewport
  const localLastPanPosRef = useRef<{ x: number; y: number } | null>(null);
  const effectivePanPosRef = lastPanPosRef || localLastPanPosRef;

  // Snapshot locked children of a section before dragging or resizing it
  const getLockedChildSnapshots = useCallback(
    (currentBoard: BoardDocument, sectionId: string) => {
      const snaps: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const node of Object.values(currentBoard.nodes)) {
        if (node.sectionId === sectionId && node.lockedToSection !== false) {
          snaps[node.id] = {
            x: node.position.x,
            y: node.position.y,
            width: node.size.width,
            height: node.size.height,
          };
        }
      }
      return snaps;
    },
    []
  );

  const startDragNode = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (!board?.nodes[id]) return;
      onDismissPopups();
      const node = board.nodes[id];
      setDraggingNode({
        id,
        startX: e.clientX,
        startY: e.clientY,
        origX: node.position.x,
        origY: node.position.y,
      });
    },
    [board, onDismissPopups]
  );

  const startResizeNode = useCallback(
    (id: string, corner: ResizeCorner, e: React.MouseEvent) => {
      if (!board?.nodes[id]) return;
      onDismissPopups();
      const node = board.nodes[id];
      setResizingNode({
        id,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        origBounds: {
          x: node.position.x,
          y: node.position.y,
          width: node.size.width,
          height: node.size.height,
        },
      });
    },
    [board, onDismissPopups]
  );

  const startDragSection = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (!board?.sections[id]) return;
      onDismissPopups();
      const sec = board.sections[id];
      setDraggingSection({
        id,
        startX: e.clientX,
        startY: e.clientY,
        origBounds: { ...sec.bounds },
        childSnapshots: getLockedChildSnapshots(board, id),
      });
    },
    [board, getLockedChildSnapshots, onDismissPopups]
  );

  const startResizeSection = useCallback(
    (id: string, corner: ResizeCorner, e: React.MouseEvent) => {
      if (!board?.sections[id]) return;
      onDismissPopups();
      const sec = board.sections[id];
      setResizingSection({
        id,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        origBounds: { ...sec.bounds },
        childSnapshots: getLockedChildSnapshots(board, id),
      });
    },
    [board, getLockedChildSnapshots, onDismissPopups]
  );

  const startConnecting = useCallback((nodeId: string, x: number, y: number) => {
    setConnectingFrom({ nodeId, x, y, currX: x + 20, currY: y });
  }, []);

  const cancelConnecting = useCallback(() => {
    setConnectingFrom(null);
  }, []);

  // Canvas mouse down (Pan or Region Select)
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) return;
      onDismissPopups();

      const target = e.target as HTMLElement | null;
      // Do not initiate canvas pan/drag if the user clicked directly inside an interactive control
      const isInteractiveControl = Boolean(
        target?.closest('input, textarea, button, select, [contenteditable="true"]')
      );
      if (isInteractiveControl) {
        return;
      }

      // Check if user clicked a node card, resize handle, or draggable section header
      const isNodeOrHandle = Boolean(
        target?.closest('[data-node-id], [data-resize-handle], [data-section-header], [data-edge-connector]')
      );

      // If user clicked a node or interactive handle, do not pan unless Pan tool or middle/Alt click is explicitly active
      if (isNodeOrHandle && activeTool !== 'pan' && e.button !== 1 && !e.altKey) {
        return;
      }

      // Hand tool (pan mode) or middle click / Alt key initiates viewport pan
      if (activeTool === 'pan' || e.button === 1 || e.altKey) {
        setIsPanning(true);
        effectivePanPosRef.current = { x: e.clientX, y: e.clientY };
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          vx: Number.isFinite(viewport.x) ? viewport.x : 0,
          vy: Number.isFinite(viewport.y) ? viewport.y : 0,
        };
        return;
      }

      // Marquee region select tool or Shift key
      if (activeTool === 'region' || e.shiftKey) {
        const pt = screenToBoard(e.clientX, e.clientY);
        setRegionDrag({ startX: pt.x, startY: pt.y, currX: pt.x, currY: pt.y });
        return;
      }

      // Default select tool on empty canvas (or empty section frame background) initiates viewport pan
      setIsPanning(true);
      effectivePanPosRef.current = { x: e.clientX, y: e.clientY };
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        vx: Number.isFinite(viewport.x) ? viewport.x : 0,
        vy: Number.isFinite(viewport.y) ? viewport.y : 0,
      };
    },
    [activeTool, effectivePanPosRef, onDismissPopups, panStartRef, screenToBoard, setIsPanning, viewport]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Auto-abort active drag/pan immediately if mouse buttons were released outside window
      if (e.buttons === 0) {
        if (
          isPanning ||
          draggingNode ||
          resizingNode ||
          draggingSection ||
          resizingSection ||
          regionDrag
        ) {
          handleCanvasMouseUp();
          return;
        }
      }

      const pt = screenToBoard(e.clientX, e.clientY);
      broadcastCursor(pt.x, pt.y, draggingNode?.id);

      if (isPanning) {
        if (effectivePanPosRef.current) {
          const dx = e.clientX - effectivePanPosRef.current.x;
          const dy = e.clientY - effectivePanPosRef.current.y;
          effectivePanPosRef.current = { x: e.clientX, y: e.clientY };

          if (Number.isFinite(dx) && Number.isFinite(dy) && Math.abs(dx) < 1500 && Math.abs(dy) < 1500) {
            setViewport((v) => ({
              ...v,
              x: (Number.isFinite(v.x) ? v.x : 0) + dx,
              y: (Number.isFinite(v.y) ? v.y : 0) + dy,
            }));
          }
        } else {
          effectivePanPosRef.current = { x: e.clientX, y: e.clientY };
        }
        return;
      }

      if (draggingNode && board) {
        const dx = (e.clientX - draggingNode.startX) / viewport.zoom;
        const dy = (e.clientY - draggingNode.startY) / viewport.zoom;
        const newX = Math.round(draggingNode.origX + dx);
        const newY = Math.round(draggingNode.origY + dy);

        setBoard((prev) => {
          if (!prev || !prev.nodes[draggingNode.id]) return prev;
          return {
            ...prev,
            nodes: {
              ...prev.nodes,
              [draggingNode.id]: {
                ...prev.nodes[draggingNode.id],
                position: { x: newX, y: newY },
              },
            },
          };
        });
        return;
      }

      if (resizingNode && board) {
        const dx = (e.clientX - resizingNode.startX) / viewport.zoom;
        const dy = (e.clientY - resizingNode.startY) / viewport.zoom;
        const nextBounds = computeResizedBounds(
          resizingNode.origBounds,
          resizingNode.corner,
          dx,
          dy,
          150,
          95
        );

        setBoard((prev) => {
          if (!prev || !prev.nodes[resizingNode.id]) return prev;
          return {
            ...prev,
            nodes: {
              ...prev.nodes,
              [resizingNode.id]: {
                ...prev.nodes[resizingNode.id],
                position: { x: nextBounds.x, y: nextBounds.y },
                size: { width: nextBounds.width, height: nextBounds.height },
              },
            },
          };
        });
        return;
      }

      if (draggingSection && board) {
        const dx = Math.round((e.clientX - draggingSection.startX) / viewport.zoom);
        const dy = Math.round((e.clientY - draggingSection.startY) / viewport.zoom);
        const newX = draggingSection.origBounds.x + dx;
        const newY = draggingSection.origBounds.y + dy;

        setBoard((prev) => {
          if (!prev || !prev.sections[draggingSection.id]) return prev;
          const sec = prev.sections[draggingSection.id];
          const updatedNodes = { ...prev.nodes };

          for (const [childId, snap] of Object.entries(draggingSection.childSnapshots)) {
            if (updatedNodes[childId]) {
              updatedNodes[childId] = {
                ...updatedNodes[childId],
                position: {
                  x: snap.x + dx,
                  y: snap.y + dy,
                },
              };
            }
          }

          return {
            ...prev,
            sections: {
              ...prev.sections,
              [draggingSection.id]: {
                ...sec,
                bounds: { ...sec.bounds, x: newX, y: newY },
              },
            },
            nodes: updatedNodes,
          };
        });
        return;
      }

      if (resizingSection && board) {
        const dx = (e.clientX - resizingSection.startX) / viewport.zoom;
        const dy = (e.clientY - resizingSection.startY) / viewport.zoom;
        const nextBounds = computeResizedBounds(
          resizingSection.origBounds,
          resizingSection.corner,
          dx,
          dy,
          320,
          220
        );

        const scaleX = nextBounds.width / resizingSection.origBounds.width;
        const scaleY = nextBounds.height / resizingSection.origBounds.height;

        setBoard((prev) => {
          if (!prev || !prev.sections[resizingSection.id]) return prev;
          const sec = prev.sections[resizingSection.id];
          const updatedNodes = { ...prev.nodes };

          for (const [childId, snap] of Object.entries(resizingSection.childSnapshots)) {
            if (updatedNodes[childId]) {
              const relX = snap.x - resizingSection.origBounds.x;
              const relY = snap.y - resizingSection.origBounds.y;
              updatedNodes[childId] = {
                ...updatedNodes[childId],
                position: {
                  x: Math.round(nextBounds.x + relX * scaleX),
                  y: Math.round(nextBounds.y + relY * scaleY),
                },
                size: {
                  width: Math.max(140, Math.round(snap.width * scaleX)),
                  height: Math.max(90, Math.round(snap.height * scaleY)),
                },
              };
            }
          }

          return {
            ...prev,
            sections: {
              ...prev.sections,
              [resizingSection.id]: {
                ...sec,
                bounds: nextBounds,
              },
            },
            nodes: updatedNodes,
          };
        });
        return;
      }

      if (connectingFrom) {
        setConnectingFrom((prev) => (prev ? { ...prev, currX: pt.x, currY: pt.y } : null));
        return;
      }

      if (regionDrag) {
        setRegionDrag((prev) => (prev ? { ...prev, currX: pt.x, currY: pt.y } : null));
      }
    },
    [
      board,
      broadcastCursor,
      connectingFrom,
      draggingNode,
      draggingSection,
      isPanning,
      panStartRef,
      regionDrag,
      resizingNode,
      resizingSection,
      screenToBoard,
      setBoard,
      setViewport,
      viewport.zoom,
    ]
  );

  const handleCanvasMouseUp = useCallback(async () => {
    if (isPanning) {
      setIsPanning(false);
      effectivePanPosRef.current = null;
      panStartRef.current = null;
    }

    if (draggingNode && board) {
      const node = board.nodes[draggingNode.id];
      setDraggingNode(null);
      if (node) {
        await sendOps([
          {
            op: 'update_node',
            id: node.id,
            patch: { position: node.position },
          },
        ]);
      }
    }

    if (resizingNode && board) {
      const node = board.nodes[resizingNode.id];
      setResizingNode(null);
      if (node) {
        await sendOps([
          {
            op: 'update_node',
            id: node.id,
            patch: { position: node.position, size: node.size },
          },
        ]);
      }
    }

    if (draggingSection && board) {
      const sec = board.sections[draggingSection.id];
      const childIds = Object.keys(draggingSection.childSnapshots);
      setDraggingSection(null);
      if (sec) {
        const ops: GraphOp[] = [
          {
            op: 'update_section',
            id: sec.id,
            patch: { bounds: sec.bounds },
          },
          ...childIds
            .filter((cid) => Boolean(board.nodes[cid]))
            .map(
              (cid): GraphOp => ({
                op: 'update_node',
                id: cid,
                patch: { position: board.nodes[cid].position },
              })
            ),
        ];
        await sendOps(ops);
      }
    }

    if (resizingSection && board) {
      const sec = board.sections[resizingSection.id];
      const childIds = Object.keys(resizingSection.childSnapshots);
      setResizingSection(null);
      if (sec) {
        const ops: GraphOp[] = [
          {
            op: 'update_section',
            id: sec.id,
            patch: { bounds: sec.bounds },
          },
          ...childIds
            .filter((cid) => Boolean(board.nodes[cid]))
            .map(
              (cid): GraphOp => ({
                op: 'update_node',
                id: cid,
                patch: {
                  position: board.nodes[cid].position,
                  size: board.nodes[cid].size,
                },
              })
            ),
        ];
        await sendOps(ops);
      }
    }

    if (connectingFrom) {
      setConnectingFrom(null);
    }

    if (regionDrag && board) {
      const x = Math.min(regionDrag.startX, regionDrag.currX);
      const y = Math.min(regionDrag.startY, regionDrag.currY);
      const width = Math.abs(regionDrag.currX - regionDrag.startX);
      const height = Math.abs(regionDrag.currY - regionDrag.startY);
      setRegionDrag(null);

      if (width > 15 && height > 15) {
        const bbox: BoundingBox = { x, y, width, height };
        const matchedIds = Object.values(board.nodes)
          .filter(
            (n) =>
              n.position.x + n.size.width >= bbox.x &&
              n.position.x <= bbox.x + bbox.width &&
              n.position.y + n.size.height >= bbox.y &&
              n.position.y <= bbox.y + bbox.height
          )
          .map((n) => n.id);

        await sendOps([
          {
            op: 'set_selection',
            nodeIds: matchedIds,
            boundingBox: bbox,
          },
        ]);
      } else {
        if (activeTool === 'select') {
          await sendOps([
            {
              op: 'set_selection',
              nodeIds: [],
              sectionId: undefined,
              boundingBox: undefined,
            },
          ]);
        }
      }
    }
  }, [
    activeTool,
    board,
    connectingFrom,
    draggingNode,
    draggingSection,
    effectivePanPosRef,
    isPanning,
    panStartRef,
    regionDrag,
    resizingNode,
    resizingSection,
    sendOps,
    setIsPanning,
  ]);

  // Window-level safety listeners to capture mousemove and mouseup outside canvas container
  useEffect(() => {
    const hasActiveInteraction = Boolean(
      isPanning ||
      draggingNode ||
      resizingNode ||
      draggingSection ||
      resizingSection ||
      regionDrag
    );
    if (!hasActiveInteraction) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      if (e.buttons === 0) {
        handleCanvasMouseUp();
        return;
      }

      if (isPanning) {
        if (effectivePanPosRef.current) {
          const dx = e.clientX - effectivePanPosRef.current.x;
          const dy = e.clientY - effectivePanPosRef.current.y;
          effectivePanPosRef.current = { x: e.clientX, y: e.clientY };

          if (Number.isFinite(dx) && Number.isFinite(dy) && Math.abs(dx) < 1500 && Math.abs(dy) < 1500) {
            setViewport((v) => ({
              ...v,
              x: (Number.isFinite(v.x) ? v.x : 0) + dx,
              y: (Number.isFinite(v.y) ? v.y : 0) + dy,
            }));
          }
        } else {
          effectivePanPosRef.current = { x: e.clientX, y: e.clientY };
        }
      }
    };

    const onWindowMouseUp = () => {
      handleCanvasMouseUp();
    };

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [
    isPanning,
    draggingNode,
    resizingNode,
    draggingSection,
    resizingSection,
    regionDrag,
    handleCanvasMouseUp,
    effectivePanPosRef,
    setViewport,
  ]);

  return {
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
  };
}
