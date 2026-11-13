# Server Route Modularization (`src/server/routes/`)

> **Parent Map:** [ARCHITECTURE.md](../ARCHITECTURE.md) · [API_AND_DX.md](./API_AND_DX.md)  
> **Primary Source Files:** [src/server/index.ts](../src/server/index.ts), [src/server/auth.ts](../src/server/auth.ts), [src/server/context.ts](../src/server/context.ts), [src/server/routes/](../src/server/routes/)

---

## Why This Change Was Needed

Previously, [src/server/index.ts](../src/server/index.ts) combined Express middleware setup, HMAC token signing/verification, WebSocket/realtime wiring, and all 13+ HTTP endpoints across boards, graph ops, prompts, webhooks, and ICM pipelines in a single 750-line file. Splitting these responsibilities into domain routers and shared auth/context modules makes endpoints easier to extend, audit, and unit-test in isolation.

## Structure

- **[`src/server/auth.ts`](../src/server/auth.ts):** `getAuthSecret`, `createSignedToken`, `verifyToken`, `hashPasscode`, and `isOriginAllowed` (CORS allowlist checks).
- **[`src/server/context.ts`](../src/server/context.ts):** Shared `ServerContext` dependency interface and `attachBoardParamValidation` (`validateBoardNameParam`) so every mounted router enforces `:name` slug validation independently.
- **[`src/server/routes/boards.ts`](../src/server/routes/boards.ts):** Board CRUD (`GET/POST /boards`, `GET/DELETE /boards/:name`), duplication, disk reload, room security/auth token exchange, and `/realtime/info`.
- **[`src/server/routes/ops.ts`](../src/server/routes/ops.ts):** Spatial slicing (`/context`), Zod-validated batch mutations & auto-layout (`/ops`), collaborator presence (`/presence`), and Markdown/Mermaid exports (`/export`).
- **[`src/server/routes/prompts.ts`](../src/server/routes/prompts.ts):** `@scrappy` prompt submission (`/prompts`) and CLI/agent resolution (`/prompts/:promptId/resolve`).
- **[`src/server/routes/ingest.ts`](../src/server/routes/ingest.ts):** Idempotent webhook and external system ingestion into `data_card` nodes (`/ingest`).
- **[`src/server/routes/icm.ts`](../src/server/routes/icm.ts):** Live ICM file inspection (`/files`), pipeline listing (`/icm/pipelines`), pipeline compilation (`/icm/build-pipeline`), and Cold-Agent Walk Test verification (`/icm/walk-test`).
- **[`src/server/index.ts`](../src/server/index.ts):** Thin server bootstrapper configuring CORS/JSON, `RealtimeBus`, `ICMAdapter`, `ServerContext`, all `/api/v1` routers, and Vite/static SPA middleware.

## Verification

Covered by [routes.test.ts](../src/server/routes/routes.test.ts), which exercises auth/CORS helpers and runs in-memory HTTP dispatch across every domain router without binding TCP sockets.
