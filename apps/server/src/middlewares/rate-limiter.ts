import type { MiddlewareHandler } from "hono";
import { env } from "@my-better-t-app/env/server";

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimiterOptions {
  maxRequests?: number;
  windowMs?: number;
  keyPrefix?: string;
}

export function rateLimiter(options?: RateLimiterOptions): MiddlewareHandler {
  const maxRequests = options?.maxRequests ?? env.RATE_LIMIT_MAX;
  const windowMs = options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const keyPrefix = options?.keyPrefix ?? "rate_limit";

  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    const now = Date.now();
    const key = `${keyPrefix}:${ip}`;

    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", String(maxRequests - 1));
      c.header("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (record.count >= maxRequests) {
      c.header("Retry-After", String(Math.ceil((record.resetTime - now) / 1000)));
      return c.json({ message: "Too many requests" }, 429);
    }

    record.count++;
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(maxRequests - record.count));
    c.header("X-RateLimit-Reset", String(Math.ceil(record.resetTime / 1000)));

    return next();
  };
}
