import { OpenAPIHono } from "@hono/zod-openapi";
import { defaultHook } from "stoker/openapi";

import type { AppBindings } from "@/lib/types";
import { authGuard } from "@/middlewares/auth-guard";
import { requirePermission } from "@/middlewares/require-permission";

import * as handlers from "./roles.handlers";
import * as routes from "./roles.routes";

const router = new OpenAPIHono<AppBindings>({ strict: false, defaultHook });

const auth = authGuard();

router.use("/roles/*", auth);
router.use("/roles", requirePermission("role:list"));
router.openapi(routes.list, handlers.list);

router.use("/roles", requirePermission("role:create"));
router.openapi(routes.create, handlers.create);

router.openapi(routes.getOne, handlers.getOne);

router.openapi(routes.patch, handlers.patch);
router.openapi(routes.remove, handlers.remove);
router.openapi(routes.getPermissions, handlers.getPermissions_);
router.openapi(routes.setPermissions, handlers.setPermissions_);

export default router;
