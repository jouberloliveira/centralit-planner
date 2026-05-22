import bcrypt from 'bcryptjs';

// OWASP ASVS L2 baseline for bcrypt (2024): work factor ≥ 12.
// CEN-22 H2: bumped from 10 → 12; rehash-on-login (see auth route) upgrades
// existing hashes opportunistically.
export const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const BCRYPT_COST_RE = /^\$2[abxy]?\$(\d{2})\$/;

export function needsRehash(hash: string): boolean {
  const match = BCRYPT_COST_RE.exec(hash);
  if (!match) return true;
  return parseInt(match[1]!, 10) < ROUNDS;
}
