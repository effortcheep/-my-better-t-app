import { pinoLogger as logger } from "hono-pino";
import pino from "pino";
import pretty from "pino-pretty";

import { env } from "@my-better-t-app/env/server";

export function pinoLogger() {
  return logger({
    pino: pino({
      level: env.LOG_LEVEL || "info",
    }, env.NODE_ENV === "production" ? undefined : pretty()),
  });
}
