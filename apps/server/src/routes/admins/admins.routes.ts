import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
  createErrorSchema,
  createMessageObjectSchema,
  IdParamsSchema,
} from "stoker/openapi/schemas";

import { selectAdminsSchema } from "@my-better-t-app/db/schema";

const tags = ["Admins"];

const adminWithoutPassword = selectAdminsSchema.omit({ passwordHash: true });

const createAdminSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100),
  email: z.string().email().max(255).optional(),
  roleId: z.number(),
});

const updateAdminSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  avatarUrl: z.string().max(500).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  roleId: z.number().optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["active", "disabled"]).optional(),
  roleId: z.coerce.number().optional(),
  keyword: z.string().optional(),
});

const paginatedResponseSchema = z.object({
  data: z.array(adminWithoutPassword),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  }),
});

const messageSchema = createMessageObjectSchema();

export const list = createRoute({
  path: "/admins",
  method: "get",
  tags,
  request: {
    query: listQuerySchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(paginatedResponseSchema, "Admin list"),
  },
});

export const create = createRoute({
  path: "/admins",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(createAdminSchema, "Admin to create"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(adminWithoutPassword, "Created admin"),
    [HttpStatusCodes.CONFLICT]: jsonContent(messageSchema, "Username already exists"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createAdminSchema),
      "Validation error",
    ),
  },
});

export const getOne = createRoute({
  path: "/admins/{id}",
  method: "get",
  tags,
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(adminWithoutPassword, "Admin details"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
  },
});

export const patch = createRoute({
  path: "/admins/{id}",
  method: "patch",
  tags,
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(updateAdminSchema, "Admin updates"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(adminWithoutPassword, "Updated admin"),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(messageSchema, "Cannot modify own status/role"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(updateAdminSchema).or(createErrorSchema(IdParamsSchema)),
      "Validation error",
    ),
  },
});

export const remove = createRoute({
  path: "/admins/{id}",
  method: "delete",
  tags,
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: "Admin deleted",
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(messageSchema, "Not found"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      messageSchema,
      "Cannot delete self or last super_admin",
    ),
  },
});

export type ListRoute = typeof list;
export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
export type PatchRoute = typeof patch;
export type RemoveRoute = typeof remove;
