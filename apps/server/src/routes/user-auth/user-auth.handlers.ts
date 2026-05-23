import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import { db } from "@my-better-t-app/db";
import { users, tokenBlacklist } from "@my-better-t-app/db/schema";
import { env } from "@my-better-t-app/env/server";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  type RefreshTokenPayload,
  type AccessTokenPayload,
} from "@/lib/jwt";

import type {
  RegisterRoute,
  LoginRoute,
  LogoutRoute,
  RefreshRoute,
  MeRoute,
} from "./user-auth.routes";

export const register: AppRouteHandler<RegisterRoute> = async (c) => {
  const { email, password } = c.req.valid("json");

  const existingUser = await db.query.users.findFirst({
    where(fields, operators) {
      return operators.eq(fields.email, email);
    },
  });

  if (existingUser) {
    return c.json({ message: "该邮箱已被注册" }, HttpStatusCodes.CONFLICT);
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST_FACTOR);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
    })
    .returning();

  const { token: accessToken } = generateAccessToken({
    sub: newUser.id,
    role: "user",
    permissions: [],
  });

  const { token: refreshToken } = generateRefreshToken({
    sub: newUser.id,
    type: "refresh",
  });

  return c.json(
    {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        createdAt: newUser.createdAt.toISOString(),
        updatedAt: newUser.updatedAt.toISOString(),
      },
    },
    HttpStatusCodes.CREATED,
  );
};

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const { email, password } = c.req.valid("json");

  const user = await db.query.users.findFirst({
    where(fields, operators) {
      return operators.eq(fields.email, email);
    },
  });

  if (!user) {
    return c.json({ message: "邮箱或密码错误" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return c.json({ message: "邮箱或密码错误" }, HttpStatusCodes.UNAUTHORIZED);
  }

  const { token: accessToken } = generateAccessToken({
    sub: user.id,
    role: "user",
    permissions: [],
  });

  const { token: refreshToken } = generateRefreshToken({
    sub: user.id,
    type: "refresh",
  });

  return c.json(
    {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    },
    HttpStatusCodes.OK,
  );
};

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
  }
  const accessToken = authHeader.slice(7);

  let accessPayload: AccessTokenPayload;
  try {
    accessPayload = verifyToken<AccessTokenPayload>(accessToken);
  } catch {
    return c.json({ message: "Token 无效或已过期" }, HttpStatusCodes.UNAUTHORIZED);
  }

  if (!accessPayload.jti || !accessPayload.exp) {
    return c.json({ message: "Token 无效" }, HttpStatusCodes.UNAUTHORIZED);
  }

  await db.insert(tokenBlacklist).values({
    tokenJti: accessPayload.jti,
    expiresAt: new Date(accessPayload.exp * 1000),
  });

  const body = (await c.req.json().catch(() => ({}))) as { refreshToken?: string };
  if (body?.refreshToken) {
    try {
      const refreshPayload = verifyToken<RefreshTokenPayload>(body.refreshToken);
      if (refreshPayload.jti && refreshPayload.exp) {
        await db.insert(tokenBlacklist).values({
          tokenJti: refreshPayload.jti,
          expiresAt: new Date(refreshPayload.exp * 1000),
        });
      }
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

  const user = await db.query.users.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, payload.sub);
    },
  });

  if (!user) {
    return c.json({ message: "Refresh Token 无效或已过期" }, HttpStatusCodes.UNAUTHORIZED);
  }

  // Blacklist old refresh token (rotation)
  await db.insert(tokenBlacklist).values({
    tokenJti: payload.jti!,
    expiresAt: new Date(payload.exp! * 1000),
  });

  const { token: newAccessToken } = generateAccessToken({
    sub: user.id,
    role: "user",
    permissions: [],
  });

  const { token: newRefreshToken } = generateRefreshToken({
    sub: user.id,
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
  const authUser = c.get("userAuthUser");

  const user = await db.query.users.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, authUser.id);
    },
  });

  if (!user) {
    return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
  }

  return c.json(
    {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    HttpStatusCodes.OK,
  );
};
