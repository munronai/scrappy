/**
 * Asynchronous debounced write-behind queue (`WriteQueue`).
 *
 * Coalesces high-frequency write bursts (e.g. continuous node drag/resize events)
 * per key into a single asynchronous disk write after an idle threshold (default 300ms),
 * while serializing in-flight writes so later mutations never race with earlier flushes.
 */
export interface WriteQueueOptions {
  /** Idle debounce threshold in milliseconds before executing the queued write. Default: 300ms. */
  debounceMs?: number;
  /** Optional error handler invoked if a queued write task rejects. */
  onError?: (key: string, error: unknown) => void;
}

export interface WriteQueueStats {
  enqueued: number;
  executed: number;
  coalesced: number;
  pendingKeys: number;
  inFlightKeys: number;
}

export class WriteQueue {
  private readonly debounceMs: number;
  private readonly onError: (key: string, error: unknown) => void;

  private readonly pendingTasks = new Map<string, () => Promise<void>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlight = new Map<string, Promise<void>>();

  private enqueuedCount = 0;
  private executedCount = 0;
  private coalescedCount = 0;

  constructor(options: WriteQueueOptions = {}) {
    this.debounceMs = Math.max(0, options.debounceMs ?? 300);
    this.onError =
      options.onError ??
      ((key, err) => {
        console.error(`[WriteQueue] Async write failed for "${key}":`, err);
      });
  }

  /**
   * Enqueues a write task for `key`, replacing any not-yet-started task for the same key
   * and resetting its idle debounce timer.
   */
  public enqueue(key: string, task: () => Promise<void>): void {
    this.enqueuedCount += 1;
    if (this.pendingTasks.has(key)) {
      this.coalescedCount += 1;
    }
    this.pendingTasks.set(key, task);

    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.timers.delete(key);
      void this.drainKey(key);
    }, this.debounceMs);

    // Prevent idle background timers from keeping short-lived CLI/test processes alive unnecessarily
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this.timers.set(key, timer);
  }

  /**
   * Cancels any pending (not yet started) debounced write for `key`.
   */
  public cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.pendingTasks.delete(key);
  }

  /**
   * Immediately flushes pending and in-flight writes for `key`, or for all keys if omitted.
   */
  public async flush(key?: string): Promise<void> {
    if (key !== undefined) {
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }
      await this.drainKey(key);
      return;
    }

    const allKeys = new Set<string>([
      ...this.timers.keys(),
      ...this.pendingTasks.keys(),
      ...this.inFlight.keys(),
    ]);
    await Promise.all(Array.from(allKeys).map((k) => this.flush(k)));
  }

  public hasPending(key?: string): boolean {
    if (key !== undefined) {
      return this.pendingTasks.has(key) || this.inFlight.has(key);
    }
    return this.pendingTasks.size > 0 || this.inFlight.size > 0;
  }

  public getStats(): WriteQueueStats {
    return {
      enqueued: this.enqueuedCount,
      executed: this.executedCount,
      coalesced: this.coalescedCount,
      pendingKeys: this.pendingTasks.size,
      inFlightKeys: this.inFlight.size,
    };
  }

  private async drainKey(key: string): Promise<void> {
    const existingInFlight = this.inFlight.get(key);
    if (existingInFlight) {
      await existingInFlight;
      if (this.pendingTasks.has(key) && !this.timers.has(key)) {
        return this.drainKey(key);
      }
      return;
    }

    const task = this.pendingTasks.get(key);
    if (!task) {
      return;
    }

    this.pendingTasks.delete(key);

    const runPromise = (async () => {
      try {
        this.executedCount += 1;
        await task();
      } catch (err) {
        this.onError(key, err);
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, runPromise);
    await runPromise;

    // If a queued task is waiting without an active debounce timer, drain it now.
    if (this.pendingTasks.has(key) && !this.timers.has(key)) {
      await this.drainKey(key);
    }
  }
}
