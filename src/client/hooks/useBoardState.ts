import { useCallback, useEffect, useRef, useState } from 'react';
import { applyOperations, AutoLayoutKind, BoardDocument, GraphOp } from '../../core/index.js';
import { BoardListing } from '../types.js';

export function useBoardState() {
  const [boardName, setBoardName] = useState<string>(() => {
    const p = new URLSearchParams(window.location.search).get('board');
    return p && p.trim() ? p.trim() : 'launch-plan';
  });

  const [board, setBoard] = useState<BoardDocument | null>(null);
  const boardRef = useRef<BoardDocument | null>(board);
  boardRef.current = board;

  const [availableBoards, setAvailableBoards] = useState<BoardListing[]>([]);

  // Sync board name with URL query parameter
  const switchBoard = useCallback((newBoardName: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('board', newBoardName);
    window.history.pushState({}, '', url.toString());
    setBoardName(newBoardName);
  }, []);

  // Listen to browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search).get('board');
      if (p && p.trim()) {
        setBoardName(p.trim());
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchAvailableBoards = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/boards');
      if (res.ok) {
        const data = await res.json();
        setAvailableBoards(data.boards || []);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/boards/${boardName}`);
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
      }
    } catch {
      // Offline fallback
    }
  }, [boardName]);

  // Send batch operations to REST API (and support optimistic local update)
  const sendOps = useCallback(
    async (operations: GraphOp[], autoLayout: AutoLayoutKind = 'none') => {
      // Optimistic local update
      setBoard((prev) => {
        if (!prev) return prev;
        const clone = JSON.parse(JSON.stringify(prev)) as BoardDocument;
        applyOperations(clone, operations, 'human', autoLayout);
        return clone;
      });

      try {
        const res = await fetch(`/api/v1/boards/${boardName}/ops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorId: 'human',
            operations,
            autoLayout,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setBoard(data.board);
        }
      } catch (err) {
        console.error('[BoardState] Failed to persist operations:', err);
      }
    },
    [boardName]
  );

  // Apply real-time delta operations received from peer users or agents
  const applyDeltaLocally = useCallback(
    (operations: GraphOp[], version: number, actorId: string) => {
      setBoard((prev) => {
        if (!prev) return prev;
        const clone = JSON.parse(JSON.stringify(prev)) as BoardDocument;
        applyOperations(clone, operations, actorId);
        clone.version = version;
        return clone;
      });
    },
    []
  );

  const createBoard = useCallback(
    async (
      slug: string,
      title?: string,
      template: 'clean' | 'default' | 'pipeline' | 'retrospective' = 'clean'
    ) => {
      const res = await fetch('/api/v1/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: slug, title, template }),
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
        switchBoard(data.board.name);
        fetchAvailableBoards();
        return data.board;
      }
      return null;
    },
    [switchBoard, fetchAvailableBoards]
  );

  const duplicateBoard = useCallback(
    async (sourceName: string, targetName: string, title?: string) => {
      const res = await fetch(`/api/v1/boards/${sourceName}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetName, title }),
      });
      if (res.ok) {
        const data = await res.json();
        setBoard(data.board);
        switchBoard(data.board.name);
        fetchAvailableBoards();
        return data.board;
      }
      return null;
    },
    [switchBoard, fetchAvailableBoards]
  );

  const reloadFromDisk = useCallback(async () => {
    const res = await fetch(`/api/v1/boards/${boardName}/reload`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setBoard(data.board);
    }
  }, [boardName]);

  const deleteBoard = useCallback(
    async (name: string) => {
      if (name === 'launch-plan') return false;
      const res = await fetch(`/api/v1/boards/${name}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAvailableBoards();
        if (boardName === name) {
          switchBoard('launch-plan');
        }
        return true;
      }
      return false;
    },
    [boardName, switchBoard, fetchAvailableBoards]
  );

  useEffect(() => {
    fetchBoard();
    fetchAvailableBoards();
  }, [fetchBoard, fetchAvailableBoards]);

  return {
    boardName,
    setBoardName: switchBoard,
    switchBoard,
    board,
    setBoard,
    boardRef,
    availableBoards,
    fetchAvailableBoards,
    fetchBoard,
    sendOps,
    applyDeltaLocally,
    createBoard,
    duplicateBoard,
    reloadFromDisk,
    deleteBoard,
  };
}
