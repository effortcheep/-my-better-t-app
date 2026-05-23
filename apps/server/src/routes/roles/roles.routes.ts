import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
  createErrorSchema,
  createMessageObjectSchema,
  IdParamsSchema,
} from "stoker/openapi/schemas";

import { selectRolesSchema, selectPermissionsSchema } from "@my-better-t-app/db/schema";

const tags = ["Roles"];

const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(255).optional(),
  permissionIds: z.array(z.number()).optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(255).optional(),
  permissionIds: z.array(z.number()).optional(),
});

const roleWithPermissionsSchema = selectRolesSchema.extend({
  permissions: z.array(selectPermissionsSchema),
});

const messageSchema = createMessageObjectSchema();

export const list = createRoute({
  path: "/roles",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectRolesSchema), "Role list"),
  },
});

export const create = createRoute({
  path: "/roles",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(createRoleSchema, "Role to create"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectRolesSchema, "Created role"),
    [HttpStatusCodes.CONFLICT]: jsonContent(messageSchema, "Role name already exists"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createRoleSchema),
      "Validation error",
    ),
  },
});

export const getOne = createRoute({
  path: "/roles/{id}",
  method: "get",
  tags,
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(roleWithPermissionsSchema, "Role with permissions"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
  },
});

export const patch = createRoute({
  path: "/roles/{id}",
  method: "patch",
  tags,
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(updateRoleSchema, "Role updates"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectRolesSchema, "Updated role"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(messageSchema, "Cannot modify system role name"),
    [HttpStatusCodes.CONFLICT]: jsonContent(messageSchema, "Role name conflict"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(updateRoleSchema).or(createErrorSchema(IdParamsSchema)),
      "Validation error",
    ),
  },
});

export const remove = createRoute({
  path: "/roles/{id}",
  method: "delete",
  tags,
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Role deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      messageSchema,
      "Cannot delete system role or role with users",
    ),
  },
});

export const getPermissions = createRoute({
  path: "/roles/{id}/permissions",
  method: "get",
  tags,
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectPermissionsSchema), "Role permissions"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
  },
});

export const setPermissions = createRoute({
  path: "/roles/{id}/permissions",
  method: "put",
  tags,
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      z.object({ permissionIds: z.array(z.number()) }),
      "Permission IDs to set",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectPermissionsSchema), "Updated permissions"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;
export type GetPermissionsRoute = typeof getPermissions;
export type SetPermissionsRoute = typeof setPermissions;
