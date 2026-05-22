export interface LockoutStore {
  isLocked(key: string): Promise<number | null>;
  recordFailure(key: string): Promise<{ locked: boolean; lockUntil: number | null }>;
  reset(key: string): Promise<void>;
}

export interface MemoryLockoutOptions {
  maxFailures?: number;
  windowMs?: number;
  lockMs?: number;
  now?: () => number;
}

interface Entry {
  count: number;
  windowStart: number;
  lockUntil: number | null;
}

// Per-account lockout (CEN-22 H1). Defaults: 10 failed attempts inside a
// 15-minute window → 15-minute lock. In-memory; single-process only. A
// multi-instance deployment must back this with a shared store (Redis).
export function createMemoryLockoutStore(opts: MemoryLockoutOptions = {}): LockoutStore {
  const maxFailures = opts.maxFailures ?? 10;
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const lockMs = opts.lockMs ?? 15 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const state = new Map<string, Entry>();

  return {
    async isLocked(key) {
      const e = state.get(key);
      if (!e || e.lockUntil === null) return null;
      if (now() >= e.lockUntil) {
        state.delete(key);
        return null;
      }
      return e.lockUntil;
    },
    async recordFailure(key) {
      const t = now();
      const cur = state.get(key) ?? { count: 0, windowStart: t, lockUntil: null };
      if (cur.lockUntil !== null && t < cur.lockUntil) {
        return { locked: true, lockUntil: cur.lockUntil };
      }
      if (t - cur.windowStart > windowMs) {
        cur.count = 0;
        cur.windowStart = t;
        cur.lockUntil = null;
      }
      cur.count += 1;
      if (cur.count >= maxFailures) {
        cur.lockUntil = t + lockMs;
      }
      state.set(key, cur);
      return { locked: cur.lockUntil !== null, lockUntil: cur.lockUntil };
    },
    async reset(key) {
      state.delete(key);
    },
  };
}
