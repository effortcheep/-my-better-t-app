import type { MiddlewareHandler } from "hono";
import * as HttpStatusCodes from "stoker/http-status-codes";

export function requirePermission(permissionCode: string): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ message: "未授权" }, HttpStatusCodes.UNAUTHORIZED);
    }

    if (user.role === "super_admin") {
      return next();
    }

    if (!user.permissions.includes(permissionCode)) {
      return c.json({ message: "权限不足" }, HttpStatusCodes.FORBIDDEN);
    }

    return next();
  };
}
