import { OpenAPIHono } from "@hono/zod-openapi";
import { defaultHook } from "stoker/openapi";

import type { AppBindings } from "@/lib/types";
import { authGuard } from "@/middlewares/auth-guard";
import { requirePermission } from "@/middlewares/require-permission";

import * as handlers from "./admins.handlers";
import * as routes from "./admins.routes";

const router = new OpenAPIHono<AppBindings>({ strict: false, defaultHook });

const auth = authGuard();

router.use("/admins/*", auth);
router.use("/admins", requirePermission("user:list"));
router.openapi(routes.list, handlers.list);

router.use("/admins", requirePermission("user:create"));
router.openapi(routes.create, handlers.create);

router.openapi(routes.getOne, handlers.getOne);

router.use("/admins/:id", requirePermission("user:update"));
router.openapi(routes.patch, handlers.patch);

router.use("/admins/:id", requirePermission("user:delete"));
router.openapi(routes.remove, handlers.remove);

export default router;
