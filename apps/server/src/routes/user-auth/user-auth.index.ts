import { OpenAPIHono } from "@hono/zod-openapi";
import { defaultHook } from "stoker/openapi";

import type { AppBindings } from "@/lib/types";
import { userAuthGuard } from "@/middlewares/user-auth-guard";
import { rateLimiter } from "@/middlewares/rate-limiter";

import * as handlers from "./user-auth.handlers";
import * as routes from "./user-auth.routes";

const router = new OpenAPIHono<AppBindings>({ strict: false, defaultHook });

// Stricter rate limiting for login to prevent brute force attacks
router.use(
  "/user/auth/login",
  rateLimiter({ maxRequests: 5, windowMs: 60_000, keyPrefix: "user_auth_login" }),
);
router.use(
  "/user/auth/register",
  rateLimiter({ maxRequests: 5, windowMs: 60_000, keyPrefix: "user_auth_register" }),
);

router.openapi(routes.register, handlers.register);
router.openapi(routes.login, handlers.login);
router.openapi(routes.refresh, handlers.refresh);

const auth = userAuthGuard();
router.use("/user/auth/logout", auth);
router.openapi(routes.logout, handlers.logout);

router.use("/user/auth/me", auth);
router.openapi(routes.me, handlers.me);

export default router;
