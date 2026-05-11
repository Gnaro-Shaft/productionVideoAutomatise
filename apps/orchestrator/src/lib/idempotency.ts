import { createHash } from 'node:crypto';
import { redis } from './redis';

export interface IdempInput {
  scope: string;                       // e.g. "GEN_IMAGE"
  parts: Record<string, unknown>;      // sceneId, promptHash, seed, modelVersion, …
}

/**
 * Deterministic key derived from {scope, parts}.
 * Same inputs ⇒ same key ⇒ same activity result is reused.
 */
export function computeIdempKey(input: IdempInput): string {
  const sortedParts = Object.fromEntries(
    Object.entries(input.parts).sort(([a], [b]) => a.localeCompare(b)),
  );
  const stable = JSON.stringify({ scope: input.scope, parts: sortedParts });
  return createHash('sha256').update(stable).digest('hex');
}

const KEY_PREFIX = 'idemp:';
const DEFAULT_TTL_S = 7 * 24 * 60 * 60; // 7 days

export async function getCachedResult<T>(key: string): Promise<T | null> {
  const cached = await redis().get(KEY_PREFIX + key);
  return cached ? (JSON.parse(cached) as T) : null;
}

export async function cacheResult<T>(
  key: string,
  result: T,
  ttlSeconds: number = DEFAULT_TTL_S,
): Promise<void> {
  await redis().set(KEY_PREFIX + key, JSON.stringify(result), 'EX', ttlSeconds);
}

/**
 * Convenience wrapper:
 *   const out = await withIdempotency('GEN_IMAGE', { sceneId, promptHash, seed }, async () => {
 *     return await actuallyRunComfy(...);
 *   });
 */
export async function withIdempotency<T>(
  scope: string,
  parts: Record<string, unknown>,
  fn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_S,
): Promise<T> {
  const key = computeIdempKey({ scope, parts });
  const cached = await getCachedResult<T>(key);
  if (cached !== null) return cached;
  const result = await fn();
  await cacheResult(key, result, ttlSeconds);
  return result;
}
