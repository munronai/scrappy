import { useCallback, useEffect, useRef, useState } from 'react';
import { BoundingBox, BoardDocument } from '../../core/types.js';
import { ActiveTool, ViewportState } from '../types.js';

export function useViewport(drawerOpen: boolean) {
  const [viewport, setViewport] = useState<ViewportState>({
    x: 40,
    y: 20,
    zoom: 0.82,
  });
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasBgRef = useRef<HTMLCanvasElement | null>(null);
  const panStartRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const lastPanPosRef = useRef<{ x: number; y: number } | null>(null);

  // Convert screen coordinates to canvas board coordinates safely
  const screenToBoard = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const sx = clientX - (rect?.left || 0);
      const sy = clientY - (rect?.top || 0);
      const safeZoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0.1 ? viewport.zoom : 0.82;
      const safeX = Number.isFinite(viewport.x) ? viewport.x : 0;
      const safeY = Number.isFinite(viewport.y) ? viewport.y : 0;
      return {
        x: (sx - safeX) / safeZoom,
        y: (sy - safeY) / safeZoom,
      };
    },
    [viewport]
  );

  // Convert canvas board coordinates to screen coordinates safely
  const boardToScreen = useCallback(
    (bx: number, by: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const safeZoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0.1 ? viewport.zoom : 0.82;
      const safeX = Number.isFinite(viewport.x) ? viewport.x : 0;
      const safeY = Number.isFinite(viewport.y) ? viewport.y : 0;
      return {
        x: (rect?.left || 0) + safeX + bx * safeZoom,
        y: (rect?.top || 0) + safeY + by * safeZoom,
      };
    },
    [viewport]
  );

  // Focus the viewport camera directly on a specified bounding box
  const focusOnBounds = useCallback((bounds: BoundingBox, padding = 80) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const screenW = rect?.width || window.innerWidth;
    const screenH = rect?.height || window.innerHeight;

    setViewport((prev) => {
      const currentZoom = Number.isFinite(prev.zoom) && prev.zoom > 0.1 ? prev.zoom : 0.82;
      const availableW = Math.max(200, screenW - padding * 2);
      const availableH = Math.max(200, screenH - padding * 2);
      const scaleX = availableW / Math.max(50, bounds.width);
      const scaleY = availableH / Math.max(50, bounds.height);
      const maxFittingZoom = Math.min(scaleX, scaleY);

      // If bounds would overflow the screen at current zoom, fit smoothly; otherwise preserve current zoom
      let targetZoom = currentZoom;
      if (bounds.width * currentZoom > availableW || bounds.height * currentZoom > availableH) {
        targetZoom = Math.min(currentZoom, Math.max(0.35, Math.min(1.0, maxFittingZoom)));
      }

      const centerBoardX = bounds.x + bounds.width / 2;
      const centerBoardY = bounds.y + bounds.height / 2;

      const targetX = screenW / 2 - centerBoardX * targetZoom;
      const targetY = screenH / 2 - centerBoardY * targetZoom;

      return {
        x: Number.isFinite(targetX) ? Math.round(targetX * 10) / 10 : 0,
        y: Number.isFinite(targetY) ? Math.round(targetY * 10) / 10 : 0,
        zoom: Number.isFinite(targetZoom) ? Number(targetZoom.toFixed(2)) : 0.82,
      };
    });
  }, []);

  // Frame and center all board elements (sections & nodes)
  const fitContent = useCallback(
    (boardDoc: BoardDocument | null) => {
      if (!boardDoc) {
        setViewport({ x: 40, y: 20, zoom: 0.82 });
        return;
      }

      const allBounds: BoundingBox[] = [];
      for (const sec of Object.values(boardDoc.sections)) {
        allBounds.push(sec.bounds);
      }
      for (const node of Object.values(boardDoc.nodes)) {
        allBounds.push({
          x: node.position.x,
          y: node.position.y,
          width: node.size.width,
          height: node.size.height,
        });
      }

      if (allBounds.length === 0) {
        setViewport({ x: 40, y: 20, zoom: 0.82 });
        return;
      }

      const minX = Math.min(...allBounds.map((b) => b.x));
      const minY = Math.min(...allBounds.map((b) => b.y));
      const maxX = Math.max(...allBounds.map((b) => b.x + b.width));
      const maxY = Math.max(...allBounds.map((b) => b.y + b.height));

      focusOnBounds(
        {
          x: minX,
          y: minY,
          width: Math.max(100, maxX - minX),
          height: Math.max(100, maxY - minY),
        },
        100
      );
    },
    [focusOnBounds]
  );

  // Wheel listener: two-finger trackpad pan or Cmd/Ctrl scroll zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setViewport((v) => ({
        ...v,
        zoom: Math.min(2.0, Math.max(0.3, Number((v.zoom * factor).toFixed(2)))),
      }));
    } else {
      setViewport((v) => ({
        ...v,
        x: (Number.isFinite(v.x) ? v.x : 0) - e.deltaX,
        y: (Number.isFinite(v.y) ? v.y : 0) - e.deltaY,
      }));
    }
  }, []);

  const zoomIn = useCallback(() => {
    setViewport((v) => ({ ...v, zoom: Math.min(2.0, Number((v.zoom + 0.1).toFixed(2))) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport((v) => ({ ...v, zoom: Math.max(0.3, Number((v.zoom - 0.1).toFixed(2))) }));
  }, []);

  const zoomReset = useCallback(() => {
    setViewport({ x: 40, y: 20, zoom: 0.82 });
  }, []);

  const startPan = useCallback(
    (clientX: number, clientY: number) => {
      setIsPanning(true);
      lastPanPosRef.current = { x: clientX, y: clientY };
      panStartRef.current = {
        x: clientX,
        y: clientY,
        vx: Number.isFinite(viewport.x) ? viewport.x : 0,
        vy: Number.isFinite(viewport.y) ? viewport.y : 0,
      };
    },
    [viewport]
  );

  const updatePan = useCallback((clientX: number, clientY: number) => {
    if (lastPanPosRef.current) {
      const dx = clientX - lastPanPosRef.current.x;
      const dy = clientY - lastPanPosRef.current.y;
      lastPanPosRef.current = { x: clientX, y: clientY };
      if (Number.isFinite(dx) && Number.isFinite(dy) && Math.abs(dx) < 1500 && Math.abs(dy) < 1500) {
        setViewport((v) => ({
          ...v,
          x: (Number.isFinite(v.x) ? v.x : 0) + dx,
          y: (Number.isFinite(v.y) ? v.y : 0) + dy,
        }));
      }
    } else {
      lastPanPosRef.current = { x: clientX, y: clientY };
    }
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
    lastPanPosRef.current = null;
    panStartRef.current = null;
  }, []);

  // Draw HTML5 Canvas infinite dot grid safely without NaN or infinite loops
  useEffect(() => {
    const canvas = canvasBgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, rect.width, rect.height);

    const safeZoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0.1 ? viewport.zoom : 0.82;
    const safeX = Number.isFinite(viewport.x) ? viewport.x : 0;
    const safeY = Number.isFinite(viewport.y) ? viewport.y : 0;

    const step = Math.max(8, 32 * safeZoom);
    const offsetX = ((safeX % step) + step) % step;
    const offsetY = ((safeY % step) + step) % step;

    ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
    for (let x = offsetX; x < rect.width; x += step) {
      for (let y = offsetY; y < rect.height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, 1.3 * safeZoom), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [viewport, drawerOpen]);

  return {
    viewport,
    setViewport,
    activeTool,
    setActiveTool,
    isPanning,
    setIsPanning,
    panStartRef,
    lastPanPosRef,
    containerRef,
    canvasBgRef,
    screenToBoard,
    boardToScreen,
    focusOnBounds,
    fitContent,
    handleWheel,
    zoomIn,
    zoomOut,
    zoomReset,
    startPan,
    updatePan,
    endPan,
  };
}
