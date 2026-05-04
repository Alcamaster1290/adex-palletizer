interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createInMemoryRateLimiter(options: { max: number; windowMs: number }) {
  const buckets = new Map<string, RateLimitEntry>();

  return function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + options.windowMs;
      buckets.set(key, {
        count: 1,
        resetAt,
      });

      return {
        allowed: true,
        remaining: Math.max(0, options.max - 1),
        resetAt,
      };
    }

    if (existing.count >= options.max) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, options.max - existing.count),
      resetAt: existing.resetAt,
    };
  };
}
