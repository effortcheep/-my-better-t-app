import { env } from "@my-better-t-app/env/web";

const BASE_URL = env.VITE_SERVER_URL;

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  status: string;
  role: { id: number; name: string };
  permissions: string[];
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

function getTokens() {
  return {
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userInfo");
}

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = getTokens();

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const { accessToken: newToken } = getTokens();
      const retryResponse = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          ...options.headers,
        },
      });

      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({ message: "请求失败" }));
        throw { status: retryResponse.status, ...error };
      }

      return retryResponse.json();
    }

    clearTokens();
    window.location.href = "/login";
    throw { status: 401, message: "未授权" };
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "请求失败" }));
    throw { status: response.status, ...error };
  }

  return response.json();
}

async function tryRefreshToken(): Promise<boolean> {
  const { refreshToken } = getTokens();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data: RefreshResponse = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "登录失败" }));
    throw { status: response.status, ...error };
  }

  const data: LoginResponse = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  localStorage.setItem("userInfo", JSON.stringify(data.user));
  return data;
}

export async function logout(): Promise<void> {
  const { refreshToken } = getTokens();

  try {
    await fetchWithAuth("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Even if API fails, clear local tokens
  }

  clearTokens();
}

export async function getCurrentUser(): Promise<UserInfo> {
  return fetchWithAuth<UserInfo>("/auth/me");
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await fetchWithAuth("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function getStoredUser(): UserInfo | null {
  const stored = localStorage.getItem("userInfo");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("accessToken");
}

export { type UserInfo, type LoginRequest, type LoginResponse };
