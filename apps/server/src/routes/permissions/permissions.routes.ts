import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import { selectPermissionsSchema } from "@my-better-t-app/db/schema";

const tags = ["Permissions"];

const listQuerySchema = z.object({
  module: z.string().optional(),
});

export const list = createRoute({
  path: "/permissions",
  method: "get",
  tags,
  request: {
    query: listQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectPermissionsSchema), "Permission list"),
  },
});

export type ListRoute = typeof list;
