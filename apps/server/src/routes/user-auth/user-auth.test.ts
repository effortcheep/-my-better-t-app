import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const mockUsers: Map<number, { id: number; email: string; passwordHash: string; createdAt: Date; updatedAt: Date }> = new Map();
const mockBlacklist: Map<string, { tokenJti: string; expiresAt: Date }> = new Map();
let nextUserId = 1;

vi.mock("@/middlewares/rate-limiter", () => ({
  rateLimiter: () => async (_: any, next: any) => next(),
}));

vi.mock("@my-better-t-app/db", () => {
  const makeProxy = () => new Proxy({}, {
    get: (_, prop) => prop,
  });

  const insertResult = (data: any) => {
    // Persist data immediately
    if (data.email !== undefined) {
      const id = nextUserId++;
      const newUser = {
        id,
        email: data.email,
        passwordHash: data.passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUsers.set(id, newUser);
    } else if (data.tokenJti !== undefined) {
      mockBlacklist.set(data.tokenJti, {
        tokenJti: data.tokenJti,
        expiresAt: data.expiresAt,
      });
    }

    return {
      returning: () => {
        if (data.email !== undefined) {
          const user = Array.from(mockUsers.values()).find(u => u.email === data.email);
          return user ? [user] : [data];
        }
        return [data];
      },
      // Support calling without .returning()
      then: (resolve: any) => resolve([data]),
    };
  };

  return {
    users: makeProxy(),
    tokenBlacklist: makeProxy(),
    db: {
      query: {
        users: {
          findFirst: async ({ where }: any) => {
            const entries = Array.from(mockUsers.values());

            const mockFields = {
              id: "id",
              email: "email",
              passwordHash: "passwordHash",
            };

            const mockOperators = {
              eq: (field: any, value: any) => ({ field, value, type: "eq" }),
            };

            if (typeof where === "function") {
              const condition = where(mockFields, mockOperators);
              if (condition && condition.type === "eq") {
                const field = condition.field;
                const value = condition.value;
                const fieldName = field === "id" ? "id" : field === "email" ? "email" : field;
                return entries.find((u) => (u as any)[fieldName] === value) || null;
              }
            }
            return null;
          },
        },
        tokenBlacklist: {
          findFirst: async ({ where }: any) => {
            const entries = Array.from(mockBlacklist.values());

            const mockFields = {
              tokenJti: "tokenJti",
            };

            const mockOperators = {
              eq: (field: any, value: any) => ({ field, value, type: "eq" }),
            };

            if (typeof where === "function") {
              const condition = where(mockFields, mockOperators);
              if (condition && condition.type === "eq") {
                return entries.find((t) => t.tokenJti === condition.value) || null;
              }
            }
            return null;
          },
        },
      },
      insert: () => ({
        values: (data: any) => insertResult(data),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    },
  };
});

const { db } = await import("@my-better-t-app/db");
const { default: userAuthRouter } = await import("./user-auth.index");
const { createTestApp } = await import("@/lib/create-app");

const app = createTestApp(userAuthRouter);

const testEmail = "test@example.com";
const testPassword = "TestPass123";
const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-min-32-chars-long-for-testing!!!";

function generateValidAccessToken(userId: number): string {
  return jwt.sign(
    { sub: userId, role: "user", permissions: [], jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: 900 }
  );
}

function generateValidRefreshToken(userId: number): string {
  return jwt.sign(
    { sub: userId, type: "refresh", jti: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: 604800 }
  );
}

async function registerUser(email: string = testEmail, password: string = testPassword) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = nextUserId++;
  const user = { id, email, passwordHash: hashedPassword, createdAt: new Date(), updatedAt: new Date() };
  mockUsers.set(id, user);
  return user;
}

describe("User Auth", () => {
  beforeEach(() => {
    mockUsers.clear();
    mockBlacklist.clear();
    nextUserId = 1;
  });

  describe("POST /user/auth/register", () => {
    it("should register with valid data", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new@example.com",
          password: testPassword,
          confirmPassword: testPassword,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
      expect(body).toHaveProperty("user");
      expect(body.user.email).toBe("new@example.com");
      expect(body.user).toHaveProperty("id");
    });

    it("should reject invalid email format", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          password: testPassword,
          confirmPassword: testPassword,
        }),
      });

      expect(res.status).toBe(422);
    });

    it("should reject weak password (less than 8 chars)", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "weak",
          confirmPassword: "weak",
        }),
      });

      expect(res.status).toBe(422);
    });

    it("should reject password without uppercase letter", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "nouppercase1",
          confirmPassword: "nouppercase1",
        }),
      });

      expect(res.status).toBe(422);
    });

    it("should reject password without lowercase letter", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "NOLOWERCASE1",
          confirmPassword: "NOLOWERCASE1",
        }),
      });

      expect(res.status).toBe(422);
    });

    it("should reject password without digit", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "NoDigitHere",
          confirmPassword: "NoDigitHere",
        }),
      });

      expect(res.status).toBe(422);
    });

    it("should reject mismatched passwords", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          confirmPassword: "DifferentPass123",
        }),
      });

      expect(res.status).toBe(422);
    });

    it("should reject duplicate email", async () => {
      await registerUser(testEmail, testPassword);

      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.message).toContain("邮箱已被注册");
    });

    it("should store password with bcrypt hash", async () => {
      const res = await app.request("/user/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "hash-test@example.com",
          password: testPassword,
          confirmPassword: testPassword,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();

      const user = Array.from(mockUsers.values()).find(u => u.email === "hash-test@example.com");
      expect(user).toBeTruthy();
      expect(user!.passwordHash).not.toBe(testPassword);
      expect(user!.passwordHash).toMatch(/^\$2[abxy]?\$/);

      const isValid = await bcrypt.compare(testPassword, user!.passwordHash);
      expect(isValid).toBe(true);
    });
  });

  describe("POST /user/auth/login", () => {
    beforeEach(async () => {
      await registerUser(testEmail, testPassword);
    });

    it("should login with valid credentials", async () => {
      const res = await app.request("/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
      expect(body).toHaveProperty("user");
      expect(body.user.email).toBe(testEmail);
    });

    it("should reject non-existent email", async () => {
      const res = await app.request("/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: testPassword,
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("邮箱或密码错误");
    });

    it("should reject wrong password", async () => {
      const res = await app.request("/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "WrongPassword123",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toBe("邮箱或密码错误");
    });

    it("should not leak email existence on failed login", async () => {
      const nonExistentRes = await app.request("/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: testPassword,
        }),
      });

      const wrongPasswordRes = await app.request("/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "WrongPassword123",
        }),
      });

      const nonExistentBody = await nonExistentRes.json();
      const wrongPasswordBody = await wrongPasswordRes.json();

      expect(nonExistentRes.status).toBe(wrongPasswordRes.status);
      expect(nonExistentBody.message).toBe(wrongPasswordBody.message);
    });

    it("should return access_token with 15 minute expiry", async () => {
      const res = await app.request("/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const decoded = jwt.decode(body.accessToken) as jwt.JwtPayload;

      expect(decoded).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
      expect(decoded.iat).toBeTruthy();

      const expiresInMinutes = (decoded.exp! - decoded.iat!) / 60;
      expect(expiresInMinutes).toBe(15);
    });

    it("should return refresh_token with 7 day expiry", async () => {
      const res = await app.request("/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const decoded = jwt.decode(body.refreshToken) as jwt.JwtPayload;

      expect(decoded).toBeTruthy();
      expect(decoded.exp).toBeTruthy();
      expect(decoded.iat).toBeTruthy();

      const expiresInDays = (decoded.exp! - decoded.iat!) / 86400;
      expect(expiresInDays).toBe(7);
    });
  });

  describe("POST /user/auth/logout", () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const user = await registerUser(testEmail, testPassword);
      accessToken = generateValidAccessToken(user.id);
      refreshToken = generateValidRefreshToken(user.id);
    });

    it("should logout successfully", async () => {
      const res = await app.request("/user/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("已成功登出");
    });

    it("should invalidate refresh_token after logout", async () => {
      await app.request("/user/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });

      const res = await app.request("/user/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(401);
    });

    it("should reject logout without authentication", async () => {
      const res = await app.request("/user/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /user/auth/refresh", () => {
    let refreshToken: string;
    let userId: number;

    beforeEach(async () => {
      const user = await registerUser(testEmail, testPassword);
      userId = user.id;
      refreshToken = generateValidRefreshToken(user.id);
    });

    it("should refresh tokens successfully", async () => {
      const res = await app.request("/user/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("accessToken");
      expect(body).toHaveProperty("refreshToken");
    });

    it("should invalidate old refresh_token after rotation", async () => {
      await app.request("/user/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const res = await app.request("/user/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      expect(res.status).toBe(401);
    });

    it("should reject invalid refresh_token", async () => {
      const res = await app.request("/user/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "invalid-token" }),
      });

      expect(res.status).toBe(401);
    });

    it("should reject expired refresh_token", async () => {
      const expiredToken = jwt.sign(
        { sub: userId, type: "refresh", jti: "expired-jti" },
        JWT_SECRET,
        { expiresIn: -10 }
      );

      const res = await app.request("/user/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: expiredToken }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /user/auth/me", () => {
    let accessToken: string;
    let userId: number;

    beforeEach(async () => {
      const user = await registerUser(testEmail, testPassword);
      userId = user.id;
      accessToken = generateValidAccessToken(user.id);
    });

    it("should return user info with valid token", async () => {
      const res = await app.request("/user/auth/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("email");
      expect(body).toHaveProperty("createdAt");
      expect(body).toHaveProperty("updatedAt");
      expect(body.email).toBe(testEmail);
    });

    it("should reject request without token", async () => {
      const res = await app.request("/user/auth/me", {
        method: "GET",
      });

      expect(res.status).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      const res = await app.request("/user/auth/me", {
        method: "GET",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(res.status).toBe(401);
    });

    it("should reject request with expired access_token", async () => {
      const expiredToken = jwt.sign(
        { sub: userId, role: "user", permissions: [], jti: "expired-jti" },
        JWT_SECRET,
        { expiresIn: -10 }
      );

      const res = await app.request("/user/auth/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(res.status).toBe(401);
    });
  });
});
