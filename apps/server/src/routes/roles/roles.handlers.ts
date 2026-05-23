import { eq, count } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import { db } from "@my-better-t-app/db";
import { roles, rolePermissions, admins } from "@my-better-t-app/db/schema";

import type {
  CreateRoute,
  GetOneRoute,
  GetPermissionsRoute,
  ListRoute,
  PatchRoute,
  RemoveRoute,
  SetPermissionsRoute,
} from "./roles.routes";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const allRoles = await db.query.roles.findMany({
    orderBy: (fields, { asc }) => [asc(fields.id)],
  });
  return c.json(allRoles);
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const body = c.req.valid("json");

  const existing = await db.query.roles.findFirst({
    where(fields, operators) {
      return operators.eq(fields.name, body.name);
    },
  });

  if (existing) {
    return c.json({ message: "角色名已存在" }, HttpStatusCodes.CONFLICT);
  }

  const [inserted] = await db
    .insert(roles)
    .values({
      name: body.name,
      description: body.description,
      isSystem: false,
    })
    .returning();

  if (body.permissionIds && body.permissionIds.length > 0) {
    await db.insert(rolePermissions).values(
      body.permissionIds.map((pid) => ({
        roleId: inserted!.id,
        permissionId: pid,
      })),
    );
  }

  return c.json(inserted!, HttpStatusCodes.CREATED);
};

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const role = await db.query.roles.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
    with: {
      rolePermissions: {
        with: {
          permission: true,
        },
      },
    },
  });

  if (!role) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json(
    {
      ...role,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    },
    HttpStatusCodes.OK,
  );
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const updates = c.req.valid("json");

  const role = await db.query.roles.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!role) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  if (role.isSystem && updates.name && updates.name !== role.name) {
    return c.json({ message: "系统内置角色名称不可修改" }, HttpStatusCodes.BAD_REQUEST);
  }

  if (updates.name && updates.name !== role.name) {
    const nameConflict = await db.query.roles.findFirst({
      where(fields, operators) {
        return operators.eq(fields.name, updates.name!);
      },
    });
    if (nameConflict) {
      return c.json({ message: "角色名已存在" }, HttpStatusCodes.CONFLICT);
    }
  }

  const { permissionIds, ...roleUpdates } = updates;

  const [updated] = await db.update(roles).set(roleUpdates).where(eq(roles.id, id)).returning();

  if (permissionIds !== undefined) {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map((pid) => ({
          roleId: id,
          permissionId: pid,
        })),
      );
    }
  }

  return c.json(updated!, HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const role = await db.query.roles.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!role) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  if (role.isSystem) {
    return c.json({ message: "系统内置角色不可删除" }, HttpStatusCodes.BAD_REQUEST);
  }

  const [userCount] = await db.select({ total: count() }).from(admins).where(eq(admins.roleId, id));

  if ((userCount?.total ?? 0) > 0) {
    return c.json({ message: "有用户关联此角色，请先转移用户" }, HttpStatusCodes.BAD_REQUEST);
  }

  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
  await db.delete(roles).where(eq(roles.id, id));

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const getPermissions_: AppRouteHandler<GetPermissionsRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const role = await db.query.roles.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!role) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  const rolePerms = await db.query.rolePermissions.findMany({
    where(fields, operators) {
      return operators.eq(fields.roleId, id);
    },
    with: {
      permission: true,
    },
  });

  return c.json(
    rolePerms.map((rp) => rp.permission),
    HttpStatusCodes.OK,
  );
};

export const setPermissions_: AppRouteHandler<SetPermissionsRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const { permissionIds } = c.req.valid("json");

  const role = await db.query.roles.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!role) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));

  if (permissionIds.length > 0) {
    await db.insert(rolePermissions).values(
      permissionIds.map((pid) => ({
        roleId: id,
        permissionId: pid,
      })),
    );
  }

  const updatedPerms = await db.query.rolePermissions.findMany({
    where(fields, operators) {
      return operators.eq(fields.roleId, id);
    },
    with: {
      permission: true,
    },
  });

  return c.json(
    updatedPerms.map((rp) => rp.permission),
    HttpStatusCodes.OK,
  );
};
