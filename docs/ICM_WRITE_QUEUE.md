# ICM Asynchronous Write-Behind Queue (`WriteQueue`)

> **Parent Map:** [ARCHITECTURE.md](../ARCHITECTURE.md) · [ICM_AND_AGENTS.md](./ICM_AND_AGENTS.md)  
> **Primary Source Files:** [src/icm/writeQueue.ts](../src/icm/writeQueue.ts), [src/icm/adapter.ts](../src/icm/adapter.ts), [src/icm/writeQueue.test.ts](../src/icm/writeQueue.test.ts)

---

## Why This Change Was Needed

Previously, every board mutation in `src/server/index.ts` (`persistAndBroadcast`) called `ICMAdapter.saveBoardToDisk(board)`, which wrote `_layout.json`, `BOARD_MAP.md`, section `CONTEXT.md` files, and node `.md` files using synchronous `fs.writeFileSync` / `fs.mkdirSync` / `fs.rmSync` on the main Node.js event loop. During high-frequency drag or resize bursts, this blocked HTTP and WebSocket packet processing for all connected collaborators.

## How It Works

1. **Debounced Coalescing ([`WriteQueue`](../src/icm/writeQueue.ts)):**
   - `enqueue(key, task)` stores the latest async write task for a board slug and resets a **300ms** idle debounce timer (`debounceMs = 300`).
   - Rapid bursts (e.g., continuous node drags) replace the pending task before the timer fires, coalescing many mutations into a single disk write.
2. **In-Flight Serialization:**
   - If a write for `key` is already executing via `node:fs/promises` when another mutation arrives, `WriteQueue` serializes the follow-up write after the active write completes so directory cleanup and file writes never race.
3. **Async `ICMAdapter` Integration ([`adapter.ts`](../src/icm/adapter.ts)):**
   - `scheduleSaveBoard(board)` takes a `structuredClone(board)` snapshot and enqueues `saveBoardToDiskAsync(snapshot)`, which executes all directory creation, tracked file writes, and stale-file cleanup via `node:fs/promises`.
   - `saveBoardToDisk(board)` remains available for short-lived synchronous CLI (`wb.ts`), MCP fallback, and unit test callers, sharing `prepareBoardWritePlan(board)` with `saveBoardToDiskAsync`.
   - `deleteBoard(boardName)` cancels any pending queued writes for that board before removing its directory.
4. **Server & Graceful Shutdown ([`src/server/index.ts`](../src/server/index.ts)):**
   - `persistAndBroadcast` calls `icm.scheduleSaveBoard(board)` so API/WebSocket responses return immediately.
   - `SIGINT` and `SIGTERM` handlers call `await icm.flushPendingWrites()` before closing the server so no debounced writes are lost on shutdown.
