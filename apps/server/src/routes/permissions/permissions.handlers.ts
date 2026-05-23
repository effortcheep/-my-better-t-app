import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/lib/types";

import { db } from "@my-better-t-app/db";

import type { ListRoute } from "./permissions.routes";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { module } = c.req.valid("query");

  if (module) {
    const filtered = await db.query.permissions.findMany({
      where(fields, operators) {
        return operators.eq(fields.module, module);
      },
      orderBy: (fields, { asc }) => [asc(fields.module), asc(fields.code)],
    });
    return c.json(filtered, HttpStatusCodes.OK);
  }

  const allPermissions = await db.query.permissions.findMany({
    orderBy: (fields, { asc }) => [asc(fields.module), asc(fields.code)],
  });

  return c.json(allPermissions, HttpStatusCodes.OK);
};
