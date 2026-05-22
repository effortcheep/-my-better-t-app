import { createRouter } from "@/lib/create-app";
import { db } from "@my-better-t-app/db";
import { sql } from "drizzle-orm";

const router = createRouter()
  .get("/health", (c) => {
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  })
  .get("/ready", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({
        status: "ready",
        timestamp: new Date().toISOString(),
        database: "connected",
      });
    } catch (error) {
      return c.json(
        {
          status: "not ready",
          timestamp: new Date().toISOString(),
          database: "disconnected",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        503,
      );
    }
  });

export default router;
