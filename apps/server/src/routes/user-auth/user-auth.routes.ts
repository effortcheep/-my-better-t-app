import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

const tags = ["User Auth"];

const registerRequestSchema = z
  .object({
    email: z.string().email("邮箱格式无效"),
    password: z
      .string()
      .min(8, "密码至少8位")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "密码需包含大小写字母和数字"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const userResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
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

const messageSchema = createMessageObjectSchema();

export const register = createRoute({
  path: "/user/auth/register",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(registerRequestSchema, "Registration data"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(loginResponseSchema, "Registration successful"),
    [HttpStatusCodes.CONFLICT]: jsonContent(messageSchema, "Email already exists"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(messageSchema, "Validation error"),
  },
});

export const login = createRoute({
  path: "/user/auth/login",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(loginRequestSchema, "Login credentials"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(loginResponseSchema, "Login successful"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(messageSchema, "Invalid credentials"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(messageSchema, "Validation error"),
  },
});

export const logout = createRoute({
  path: "/user/auth/logout",
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
  path: "/user/auth/refresh",
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
  path: "/user/auth/me",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(userResponseSchema, "Current user info"),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(messageSchema, "Unauthorized"),
  },
});

export type RegisterRoute = typeof register;
export type LoginRoute = typeof login;
export type LogoutRoute = typeof logout;
export type RefreshRoute = typeof refresh;
export type MeRoute = typeof me;
