import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import { db } from "@my-better-t-app/db";
import { admins, tokenBlacklist } from "@my-better-t-app/db/schema";
import { env } from "@my-better-t-app/env/server";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  type RefreshTokenPayload,
  type AccessTokenPayload,
} from "@/lib/jwt";

import type {
  LoginRoute,
  LogoutRoute,
  RefreshRoute,
  MeRoute,
  ChangePasswordRoute,
} from "./auth.routes";

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const { username, password } = c.req.valid("json");

  const admin = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.username, username);
    },
    with: {
      role: true,
    },
  });

  if (!admin) {
    return c.json({ message: "用户名或密码错误" }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (admin.status === "disabled") {
    return c.json({ message: "账户已被禁用" }, HttpStatusCodes.FORBIDDEN);
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash);
  if (!validPassword) {
    return c.json({ message: "用户名或密码错误" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const rolePerms = await db.query.rolePermissions.findMany({
    where(fields, operators) {
      return operators.eq(fields.roleId, admin.roleId!);
    },
    with: {
      permission: true,
    },
  });

  const permCodes = rolePerms.map((rp) => rp.permission.code);
  const roleName = admin.role?.name ?? "";

  const { token: accessToken } = generateAccessToken({
    sub: admin.id,
    role: roleName,
    permissions: permCodes,
  });

  const { token: refreshToken } = generateRefreshToken({
    sub: admin.id,
    type: "refresh",
  });

  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));

  return c.json(
    {
      accessToken,
      refreshToken,
      user: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        email: admin.email,
        avatarUrl: admin.avatarUrl,
        role: admin.role ? { id: admin.role.id, name: admin.role.name } : { id: 0, name: "" },
        permissions: permCodes,
      },
    },
    HttpStatusCodes.OK,
  );
};

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
  const authHeader = c.req.header("Authorization")!;
  const accessToken = authHeader.slice(7);

  const accessPayload = verifyToken<AccessTokenPayload>(accessToken);

  await db.insert(tokenBlacklist).values({
    tokenJti: accessPayload.jti!,
    expiresAt: new Date(accessPayload.exp! * 1000),
  });

  const body = (await c.req.json().catch(() => ({}))) as { refreshToken?: string };
  if (body?.refreshToken) {
    try {
      const refreshPayload = verifyToken<RefreshTokenPayload>(body.refreshToken);
      await db.insert(tokenBlacklist).values({
        tokenJti: refreshPayload.jti!,
        expiresAt: new Date(refreshPayload.exp! * 1000),
      });
    } catch {
      // Refresh token already invalid, skip
    }
  }

  return c.json({ message: "已成功登出" }, HttpStatusCodes.OK);
};

export const refresh: AppRouteHandler<RefreshRoute> = async (c) => {
  const { refreshToken } = c.req.valid("json");

  let payload: RefreshTokenPayload;
  try {
    payload = verifyToken<RefreshTokenPayload>(refreshToken);
  } catch {
    return c.json({ message: "Refresh Token 无效或已过期" }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (payload.type !== "refresh") {
    return c.json({ message: "Refresh Token 无效或已过期" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const blacklisted = await db.query.tokenBlacklist.findFirst({
    where(fields, operators) {
      return operators.eq(fields.tokenJti, payload.jti!);
    },
  });

  if (blacklisted) {
    return c.json({ message: "Refresh Token 无效或已过期" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const admin = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, payload.sub);
    },
    with: {
      role: true,
    },
  });

  if (!admin || admin.status === "disabled") {
    return c.json({ message: "Refresh Token 无效或已过期" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const rolePerms = await db.query.rolePermissions.findMany({
    where(fields, operators) {
      return operators.eq(fields.roleId, admin.roleId!);
    },
    with: {
      permission: true,
    },
  });

  const permCodes = rolePerms.map((rp) => rp.permission.code);
  const roleName = admin.role?.name ?? "";

  // Blacklist old refresh token (rotation)
  await db.insert(tokenBlacklist).values({
    tokenJti: payload.jti!,
    expiresAt: new Date(payload.exp! * 1000),
  });

  const { token: newAccessToken } = generateAccessToken({
    sub: admin.id,
    role: roleName,
    permissions: permCodes,
  });

  const { token: newRefreshToken } = generateRefreshToken({
    sub: admin.id,
    type: "refresh",
  });

  return c.json(
    {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    },
    HttpStatusCodes.OK,
  );
};

export const me: AppRouteHandler<MeRoute> = async (c) => {
  const authUser = c.get("user");

  const admin = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, authUser.id);
    },
    with: {
      role: true,
    },
  });

  if (!admin) {
    return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const rolePerms = await db.query.rolePermissions.findMany({
    where(fields, operators) {
      return operators.eq(fields.roleId, admin.roleId!);
    },
    with: {
      permission: true,
    },
  });

  const permCodes = rolePerms.map((rp) => rp.permission.code);

  return c.json(
    {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      email: admin.email,
      avatarUrl: admin.avatarUrl,
      status: admin.status,
      role: admin.role ? { id: admin.role.id, name: admin.role.name } : { id: 0, name: "" },
      permissions: permCodes,
    },
    HttpStatusCodes.OK,
  );
};

export const changePassword: AppRouteHandler<ChangePasswordRoute> = async (c) => {
  const authUser = c.get("user");
  const { currentPassword, newPassword } = c.req.valid("json");

  const admin = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, authUser.id);
    },
  });

  if (!admin) {
    return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const validPassword = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!validPassword) {
    return c.json({ message: "当前密码错误" }, HttpStatusCodes.BAD_REQUEST);
  }

  const newHash = await bcrypt.hash(newPassword, env.BCRYPT_COST_FACTOR);

  await db.update(admins).set({ passwordHash: newHash }).where(eq(admins.id, authUser.id));

  // Blacklist current token to force re-login
  const authHeader = c.req.header("Authorization")!;
  const accessToken = authHeader.slice(7);
  const accessPayload = verifyToken<AccessTokenPayload>(accessToken);

  await db.insert(tokenBlacklist).values({
    tokenJti: accessPayload.jti!,
    expiresAt: new Date(accessPayload.exp! * 1000),
  });

  return c.json({ message: "密码修改成功，请重新登录" }, HttpStatusCodes.OK);
};
