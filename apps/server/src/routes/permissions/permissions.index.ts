import { OpenAPIHono } from "@hono/zod-openapi";
import { defaultHook } from "stoker/openapi";

import type { AppBindings } from "@/lib/types";
import { authGuard } from "@/middlewares/auth-guard";

import * as handlers from "./permissions.handlers";
import * as routes from "./permissions.routes";

const router = new OpenAPIHono<AppBindings>({ strict: false, defaultHook });

router.use("/permissions", authGuard());
router.openapi(routes.list, handlers.list);

export default router;
