import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const tags = ["Auth"];

const loginRequestSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
});

const userResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.object({
    id: z.number(),
    name: z.string(),
  }),
  permissions: z.array(z.string()),
});

const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userResponseSchema,
});

const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});

const refreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "密码需包含大小写字母和数字"),
});

const messageSchema = createMessageObjectSchema();

export const login = createRoute({
  path: "/auth/login",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(loginRequestSchema, "Login credentials"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(loginResponseSchema, "Login successful"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(messageSchema, "Invalid credentials"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Account disabled"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createMessageObjectSchema(),
      "Validation error",
    ),
  },
});

export const logout = createRoute({
  path: "/auth/logout",
  method: "post",
  tags,
  request: {
    body: jsonContent(
      z.object({ refreshToken: z.string().optional() }).optional(),
      "Optional refresh token to blacklist",
    ),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Logout successful"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(messageSchema, "Unauthorized"),
  },
});

export const refresh = createRoute({
  path: "/auth/refresh",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(refreshRequestSchema, "Refresh token"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(refreshResponseSchema, "Tokens refreshed"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(messageSchema, "Invalid refresh token"),
  },
});

export const me = createRoute({
  path: "/auth/me",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(userResponseSchema, "Current user info"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(messageSchema, "Unauthorized"),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(messageSchema, "Account disabled"),
  },
});

export const changePassword = createRoute({
  path: "/auth/change-password",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(changePasswordRequestSchema, "Password change data"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), "Password changed"),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(messageSchema, "Current password incorrect"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(messageSchema, "Unauthorized"),
  },
});

export type LoginRoute = typeof login;
export type LogoutRoute = typeof logout;
export type RefreshRoute = typeof refresh;
export type MeRoute = typeof me;
export type ChangePasswordRoute = typeof changePassword;
