import 'server-only';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

declare global {
  var __videogenRateLimitStore: Map<string, RateLimitBucket> | undefined;
}

const store = global.__videogenRateLimitStore ?? new Map<string, RateLimitBucket>();
global.__videogenRateLimitStore = store;

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

export function getRateLimitKey(options: {
  request: Request;
  userId?: string | null;
  scope: string;
}): string {
  const actor = options.userId?.trim() || `ip:${getRequestIp(options.request)}`;
  return `${options.scope}:${actor}`;
}

export function consumeRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = store.get(options.key);

  let bucket: RateLimitBucket;
  if (!existing || existing.resetAt <= now) {
    bucket = {
      count: 0,
      resetAt: now + options.windowMs,
    };
  } else {
    bucket = existing;
  }

  bucket.count += 1;
  store.set(options.key, bucket);

  const allowed = bucket.count <= options.limit;
  const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
  const remaining = Math.max(options.limit - bucket.count, 0);

  if (store.size > 10_000) {
    for (const [key, value] of store.entries()) {
      if (value.resetAt <= now) {
        store.delete(key);
      }
    }
  }

  return {
    allowed,
    limit: options.limit,
    remaining,
    retryAfterSeconds,
    resetAt: bucket.resetAt,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    'Retry-After': String(result.retryAfterSeconds),
  };
}
