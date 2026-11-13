import { useCallback, useEffect, useRef, useState } from 'react';
import { BoardDocument, CollaboratorPresence, GraphOp } from '../../core/index.js';
import { RealtimeMessage, TransportMode } from '../../realtime/types.js';
import { UserIdentity, USER_PALETTES, ViewportState } from '../types.js';

interface UseRealtimeSocketProps {
  boardName: string;
  onBoardSync: (board: BoardDocument) => void;
  onDeltaSync: (operations: GraphOp[], version: number, actorId: string) => void;
  onFollowUpdate?: (cursor: { x: number; y: number }, viewport?: ViewportState) => void;
  authToken?: string;
  passcode?: string;
}

export function useRealtimeSocket({
  boardName,
  onBoardSync,
  onDeltaSync,
  onFollowUpdate,
  authToken,
  passcode,
}: UseRealtimeSocketProps) {
  const [wsConnected, setWsConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('ws');
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [activityLog, setActivityLog] = useState<Array<{ time: string; actor: string; text: string }>>([]);
  const [followingActorId, setFollowingActorId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const lastCursorBroadcastRef = useRef<number>(0);
  const followingActorIdRef = useRef<string | null>(null);
  followingActorIdRef.current = followingActorId;

  // Multi-user identity initialization:
  // Reads ?user= or ?name= or ?color= from URL if present (ideal for 2 local tabs: ?name=Alice, ?name=Bob),
  // otherwise restores from sessionStorage, or generates a clean default.
  const [identity, setIdentityState] = useState<UserIdentity>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlName = params.get('user') || params.get('name');
    const urlColor = params.get('color');

    let saved: UserIdentity | null = null;
    try {
      const raw = sessionStorage.getItem('scrappy_user_identity');
      if (raw) saved = JSON.parse(raw);
    } catch {}

    const actorId =
      saved?.actorId ||
      params.get('actorId') ||
      `user-${Math.random().toString(36).slice(2, 7)}`;

    const paletteIdx = Math.abs(
      actorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    ) % USER_PALETTES.length;
    const defaultColor = USER_PALETTES[paletteIdx].hex;

    const finalIdentity: UserIdentity = {
      actorId,
      name: urlName || saved?.name || `Collaborator ${actorId.slice(-3).toUpperCase()}`,
      color: urlColor ? (urlColor.startsWith('#') ? urlColor : `#${urlColor}`) : saved?.color || defaultColor,
      role: 'human',
    };

    try {
      sessionStorage.setItem('scrappy_user_identity', JSON.stringify(finalIdentity));
    } catch {}

    return finalIdentity;
  });

  const identityRef = useRef<UserIdentity>(identity);
  identityRef.current = identity;

  const setIdentity = useCallback((updater: Partial<UserIdentity> | ((prev: UserIdentity) => UserIdentity)) => {
    setIdentityState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      try {
        sessionStorage.setItem('scrappy_user_identity', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Fetch transport diagnostics (Native WS vs Ably Cloud vs Federated)
  useEffect(() => {
    fetch('/api/v1/realtime/info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.transport) {
          setTransportMode(data.transport);
        }
      })
      .catch(() => {});
  }, [boardName]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let wsUrl = `${protocol}//${window.location.host}/ws?board=${encodeURIComponent(boardName)}`;
    wsUrl += `&actorId=${encodeURIComponent(identity.actorId)}`;
    wsUrl += `&name=${encodeURIComponent(identity.name)}`;
    wsUrl += `&color=${encodeURIComponent(identity.color)}`;
    if (authToken) wsUrl += `&token=${encodeURIComponent(authToken)}`;
    if (passcode) wsUrl += `&passcode=${encodeURIComponent(passcode)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      // Announce client identity to room
      ws.send(
        JSON.stringify({
          type: 'join',
          boardName,
          actorId: identity.actorId,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as RealtimeMessage;
        if (msg.boardName && msg.boardName !== boardName) return;

        switch (msg.type) {
          case 'board.sync':
            onBoardSync(msg.board);
            break;

          case 'op.delta':
            onDeltaSync(msg.operations, msg.version, msg.actorId);
            break;

          case 'presence.sync': {
            const others = msg.collaborators.filter((c) => c.actorId !== identityRef.current.actorId);
            setCollaborators(others);

            // If we are currently following a collaborator, handle their cursor & viewport updates
            const followed = others.find((c) => c.actorId === followingActorIdRef.current);
            if (followed && onFollowUpdate) {
              onFollowUpdate(followed.cursor, followed.viewport);
            }
            break;
          }

          case 'presence.update': {
            if (msg.presence && msg.presence.actorId !== identityRef.current.actorId) {
              setCollaborators((prev) => {
                const idx = prev.findIndex((c) => c.actorId === msg.presence.actorId);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = msg.presence;
                  return copy;
                }
                return [...prev, msg.presence];
              });

              if (msg.presence.actorId === followingActorIdRef.current && onFollowUpdate) {
                onFollowUpdate(msg.presence.cursor, msg.presence.viewport);
              }
            }
            break;
          }

          case 'presence.leave':
            setCollaborators((prev) => prev.filter((c) => c.actorId !== msg.actorId));
            if (followingActorIdRef.current === msg.actorId) {
              setFollowingActorId(null);
            }
            break;

          case 'agent.activity':
            setActivityLog((prev) => [
              {
                time: new Date(msg.timestamp).toLocaleTimeString(),
                actor: msg.actorId,
                text: msg.statusText,
              },
              ...prev.slice(0, 49),
            ]);
            break;
        }
      } catch {
        // Ignore malformed message
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [boardName, authToken, passcode, onBoardSync, onDeltaSync, onFollowUpdate]);

  // Broadcast mouse cursor & viewport to remote teammates & agents (throttled to 40ms / 25fps)
  const broadcastCursor = useCallback(
    (boardX: number, boardY: number, activeNodeId?: string, viewport?: ViewportState) => {
      const now = Date.now();
      if (now - lastCursorBroadcastRef.current < 40) return;
      lastCursorBroadcastRef.current = now;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'presence.update',
            boardName,
            presence: {
              actorId: identityRef.current.actorId,
              name: identityRef.current.name,
              role: identityRef.current.role,
              color: identityRef.current.color,
              cursor: { x: Math.round(boardX), y: Math.round(boardY) },
              viewport,
              activeNodeId,
              updatedAt: now,
            },
          })
        );
      }
    },
    [boardName]
  );

  // Follow Teammate controls
  const startFollowing = useCallback((actorId: string) => {
    setFollowingActorId(actorId);
  }, []);

  const stopFollowing = useCallback(() => {
    setFollowingActorId(null);
  }, []);

  return {
    wsConnected,
    transportMode,
    collaborators,
    activityLog,
    broadcastCursor,
    currentActorId: identity.actorId,
    identity,
    setIdentity,
    followingActorId,
    startFollowing,
    stopFollowing,
  };
}
