import type { MiddlewareHandler } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";

import { db } from "@my-better-t-app/db";

import { type AccessTokenPayload, verifyToken } from "@/lib/jwt";

export function authGuard(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const token = authHeader.slice(7);

    let payload: AccessTokenPayload;
    try {
      payload = verifyToken<AccessTokenPayload>(token);
    } catch {
      return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const blacklisted = await db.query.tokenBlacklist.findFirst({
      where(fields, operators) {
        return operators.eq(fields.tokenJti, payload.jti!);
      },
    });

    if (blacklisted) {
      return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const user = await db.query.admins.findFirst({
      where(fields, operators) {
        return operators.eq(fields.id, payload.sub);
      },
    });

    if (!user) {
      return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
    }

    if (user.status === "disabled") {
      return c.json({ message: "账户已被禁用" }, HttpStatusCodes.FORBIDDEN);
    }

    c.set("user", {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: payload.role,
      permissions: payload.permissions,
    });

    await next();
  };
}
