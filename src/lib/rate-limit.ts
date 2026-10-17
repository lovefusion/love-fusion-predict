/**
 * Simple in-memory rate limiter for Netlify serverless functions.
 *
 * Note: In-memory state is per-function-instance.
 * For multi-instance deployments, upgrade to a Redis-backed store.
 * This is sufficient for ~200 participants on Netlify.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const WINDOW_MS  = 60_000;  // 1 minute
const DEFAULT_MAX = parseInt(process.env.RATE_LIMIT_PER_IP ?? "10", 10);

export function checkRateLimit(key: string, maxRequests = DEFAULT_MAX): boolean {
  const now = Date.now();
  const win = store.get(key);

  if (!win || now > win.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (win.count >= maxRequests) return false;

  win.count++;
  return true;
}

/** Extract client IP from Next.js request headers */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
