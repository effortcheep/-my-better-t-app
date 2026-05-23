import { relations } from "drizzle-orm";
import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { roles } from "./roles";

export const admins = pgTable("admins", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  username: varchar({ length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  email: varchar({ length: 255 }).unique(),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  status: varchar({ length: 20 }).notNull().default("active"),
  roleId: integer("role_id").references(() => roles.id),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const adminsRelations = relations(admins, ({ one }) => ({
  role: one(roles, {
    fields: [admins.roleId],
    references: [roles.id],
  }),
}));

export const selectAdminsSchema = createSelectSchema(admins);
export const insertAdminsSchema = createInsertSchema(admins);
export const patchAdminsSchema = insertAdminsSchema.partial();
