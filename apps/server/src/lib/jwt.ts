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

function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)([mhd])$/);
  if (!match) {
    throw new Error(`Invalid expires format: ${value}`);
  }
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "m":
      return num * 60;
    case "h":
      return num * 3600;
    case "d":
      return num * 86400;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

export function generateAccessToken(payload: Omit<AccessTokenPayload, "jti" | "iat" | "exp">) {
  const jti = randomUUID();
  return {
    token: jwt.sign({ ...payload, jti }, env.JWT_SECRET, {
      expiresIn: parseExpiresIn(env.JWT_ACCESS_EXPIRES_IN),
    }),
    jti,
  };
}

export function generateRefreshToken(payload: Omit<RefreshTokenPayload, "jti" | "iat" | "exp">) {
  const jti = randomUUID();
  return {
    token: jwt.sign({ ...payload, jti }, env.JWT_SECRET, {
      expiresIn: parseExpiresIn(env.JWT_REFRESH_EXPIRES_IN),
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
