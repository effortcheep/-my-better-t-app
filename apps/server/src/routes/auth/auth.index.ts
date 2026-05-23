import { OpenAPIHono } from "@hono/zod-openapi";
import { defaultHook } from "stoker/openapi";

import type { AppBindings } from "@/lib/types";
import { authGuard } from "@/middlewares/auth-guard";

import * as handlers from "./auth.handlers";
import * as routes from "./auth.routes";

const router = new OpenAPIHono<AppBindings>({ strict: false, defaultHook });

router.openapi(routes.login, handlers.login);
router.openapi(routes.refresh, handlers.refresh);

const auth = authGuard();
router.use("/auth/logout", auth);
router.openapi(routes.logout, handlers.logout);

router.use("/auth/me", auth);
router.openapi(routes.me, handlers.me);

router.use("/auth/change-password", auth);
router.openapi(routes.changePassword, handlers.changePassword);

export default router;
