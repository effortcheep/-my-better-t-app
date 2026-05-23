import { and, count, eq, ilike, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import { db } from "@my-better-t-app/db";
import { admins, roles } from "@my-better-t-app/db/schema";
import { env } from "@my-better-t-app/env/server";

import type { CreateRoute, GetOneRoute, ListRoute, PatchRoute, RemoveRoute } from "./admins.routes";

function excludePassword(admin: typeof admins.$inferSelect) {
  const { passwordHash: _, ...rest } = admin;
  return rest;
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { page, pageSize, status, roleId, keyword } = c.req.valid("query");
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (status) {
    conditions.push(eq(admins.status, status));
  }
  if (roleId) {
    conditions.push(eq(admins.roleId, roleId));
  }
  if (keyword) {
    conditions.push(
      or(ilike(admins.username, `%${keyword}%`), ilike(admins.displayName, `%${keyword}%`))!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ total: count() }).from(admins).where(whereClause);

  const data = await db.query.admins.findMany({
    where: whereClause ? () => whereClause : undefined,
    limit: pageSize,
    offset,
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
  });

  return c.json(
    {
      data: data.map(excludePassword),
      pagination: {
        page,
        pageSize,
        total: totalResult?.total ?? 0,
      },
    },
    HttpStatusCodes.OK,
  );
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const body = c.req.valid("json");

  const existing = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.username, body.username);
    },
  });

  if (existing) {
    return c.json({ message: "用户名已存在" }, HttpStatusCodes.CONFLICT);
  }

  const passwordHash = await bcrypt.hash(body.password, env.BCRYPT_COST_FACTOR);

  const [inserted] = await db
    .insert(admins)
    .values({
      username: body.username,
      passwordHash,
      displayName: body.displayName,
      email: body.email,
      roleId: body.roleId,
    })
    .returning();

  return c.json(excludePassword(inserted!), HttpStatusCodes.CREATED);
};

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid("param");

  const admin = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
  });

  if (!admin) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json(excludePassword(admin), HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const updates = c.req.valid("json");
  const currentUser = c.get("user");

  if (id === currentUser.id && (updates.status || updates.roleId)) {
    return c.json({ message: "不能修改自己的状态和角色" }, HttpStatusCodes.BAD_REQUEST);
  }

  const [updated] = await db.update(admins).set(updates).where(eq(admins.id, id)).returning();

  if (!updated) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  return c.json(excludePassword(updated), HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const currentUser = c.get("user");

  if (id === currentUser.id) {
    return c.json({ message: "不能删除自己" }, HttpStatusCodes.BAD_REQUEST);
  }

  const admin = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, id);
    },
    with: {
      role: true,
    },
  });

  if (!admin) {
    return c.json({ message: "未找到" }, HttpStatusCodes.NOT_FOUND);
  }

  if (admin.role?.name === "super_admin") {
    const [superAdminCount] = await db
      .select({ total: count() })
      .from(admins)
      .innerJoin(roles, eq(admins.roleId, roles.id))
      .where(eq(roles.name, "super_admin"));

    if ((superAdminCount?.total ?? 0) <= 1) {
      return c.json({ message: "不能删除最后一个超级管理员" }, HttpStatusCodes.BAD_REQUEST);
    }
  }

  await db.delete(admins).where(eq(admins.id, id));

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
