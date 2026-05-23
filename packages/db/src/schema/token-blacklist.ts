import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const tokenBlacklist = pgTable("token_blacklist", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  tokenJti: varchar("token_jti", { length: 100 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const selectTokenBlacklistSchema = createSelectSchema(tokenBlacklist);
export const insertTokenBlacklistSchema = createInsertSchema(tokenBlacklist);
