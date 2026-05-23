import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

import { env } from "@my-better-t-app/env/server";

export interface AccessTokenPayload {
  sub: number;
  role: string;
  permissions: string[];
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface RefreshTokenPayload {
  sub: number;
  type: "refresh";
  iat?: number;
  exp?: number;
  jti?: string;
}

export function generateAccessToken(payload: Omit<AccessTokenPayload, "jti" | "iat" | "exp">) {
  const jti = randomUUID();
  return {
    token: jwt.sign({ ...payload, jti }, env.JWT_SECRET, {
      expiresIn: Number(env.JWT_ACCESS_EXPIRES_IN.replace("h", "")) * 3600,
    }),
    jti,
  };
}

export function generateRefreshToken(payload: Omit<RefreshTokenPayload, "jti" | "iat" | "exp">) {
  const jti = randomUUID();
  return {
    token: jwt.sign({ ...payload, jti }, env.JWT_SECRET, {
      expiresIn: Number(env.JWT_REFRESH_EXPIRES_IN.replace("d", "")) * 86400,
    }),
    jti,
  };
}

export function verifyToken<T extends object>(token: string): T {
  return jwt.verify(token, env.JWT_SECRET) as T;
}

export function decodeToken<T extends object>(token: string): T | null {
  try {
    return jwt.decode(token) as T;
  } catch {
    return null;
  }
}
