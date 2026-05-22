import { createHash } from 'node:crypto';

export interface BreachChecker {
  isBreached(password: string): Promise<boolean>;
}

const HIBP_URL = 'https://api.pwnedpasswords.com/range/';
const HIBP_TIMEOUT_MS = 3000;

// HIBP "Pwned Passwords" k-anonymity range API: send the first 5 hex chars of
// SHA-1(password) and receive every matching suffix. The raw password never
// leaves this process.
//
// Fail-open on transient errors (network / timeout / non-2xx). Breach check is
// defense-in-depth on top of length rules; account creation must not depend on
// a third-party service being reachable.
export const hibpBreachChecker: BreachChecker = {
  async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await fetch(`${HIBP_URL}${prefix}`, {
        headers: { 'Add-Padding': 'true', 'User-Agent': 'centralit-planner-api' },
        signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
      });
      if (!res.ok) return false;
      const body = await res.text();
      for (const line of body.split(/\r?\n/)) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const hashSuffix = line.slice(0, idx).trim();
        const countStr = line.slice(idx + 1).trim();
        if (hashSuffix === suffix && Number(countStr) > 0) return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};

export const noopBreachChecker: BreachChecker = {
  async isBreached(): Promise<boolean> {
    return false;
  },
};
