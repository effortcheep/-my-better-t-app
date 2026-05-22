import type { Schema } from "hono";

import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { requestId } from "hono/request-id";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";

import { env } from "@my-better-t-app/env/server";
import { pinoLogger } from "@/middlewares/pino-logger";
import { rateLimiter } from "@/middlewares/rate-limiter";

import type { AppBindings, AppOpenAPI } from "./types";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook,
  });
}

export default function createApp() {
  const app = createRouter();

  app.use(requestId())
    .use(serveEmojiFavicon("📝"))
    .use(pinoLogger())
    .use(secureHeaders())
    .use(
      "/*",
      cors({
        origin: env.CORS_ORIGIN,
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        exposeHeaders: ["X-Request-Id"],
        maxAge: 86400,
      }),
    )
    .use("/api/*", rateLimiter());

  app.notFound(notFound);
  app.onError(onError);
  return app;
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route("/", router);
}
