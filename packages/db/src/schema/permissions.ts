import { relations } from "drizzle-orm";
import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { rolePermissions } from "./role-permissions";

export const permissions = pgTable("permissions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  code: varchar({ length: 100 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  module: varchar({ length: 50 }).notNull(),
  type: varchar({ length: 20 }).notNull(),
  description: varchar({ length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const selectPermissionsSchema = createSelectSchema(permissions);
export const insertPermissionsSchema = createInsertSchema(permissions);
export const patchPermissionsSchema = insertPermissionsSchema.partial();
