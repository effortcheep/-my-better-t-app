import { serve } from "@hono/node-server";
import { env } from "@my-better-t-app/env/server";

import app from "./app";

const port = env.PORT;

const server = serve({
  fetch: app.fetch,
  port,
});

console.log(`Server is running on http://localhost:${port}`);

function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
