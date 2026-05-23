import { relations } from "drizzle-orm";
import { integer, pgTable, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { permissions } from "./permissions";
import { roles } from "./roles";

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: integer("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => [unique().on(t.roleId, t.permissionId)],
);

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const selectRolePermissionsSchema = createSelectSchema(rolePermissions);
export const insertRolePermissionsSchema = createInsertSchema(rolePermissions);
