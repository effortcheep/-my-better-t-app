import { createSignal, Show } from "solid-js";
import { useNavigate, createFileRoute, redirect } from "@tanstack/solid-router";
import { login, isAuthenticated } from "@/lib/auth-api";
import { useAuth } from "@/contexts/auth-context";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (isAuthenticated()) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    if (!username().trim() || !password().trim()) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    try {
      const result = await login({
        username: username(),
        password: password(),
      });
      auth.setUser(result.user);
      const searchParams = new URLSearchParams(window.location.search);
      const redirectTo = searchParams.get("redirect") || "/dashboard";
      navigate({ to: redirectTo });
    } catch (err: any) {
      setError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex items-center justify-center min-h-[calc(100vh-3rem)]">
      <div class="w-full max-w-md p-8 rounded-lg border border-neutral-800 bg-neutral-900">
        <h1 class="text-2xl font-bold text-center mb-6">管理员登录</h1>

        <Show when={error()}>
          <div class="mb-4 p-3 rounded bg-red-900/50 border border-red-700 text-red-200 text-sm">
            {error()}
          </div>
        </Show>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1" for="username">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              class="w-full px-3 py-2 rounded border border-neutral-700 bg-neutral-800 text-neutral-100 focus:outline-none focus:border-neutral-500"
              placeholder="请输入用户名"
              disabled={loading()}
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1" for="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              class="w-full px-3 py-2 rounded border border-neutral-700 bg-neutral-800 text-neutral-100 focus:outline-none focus:border-neutral-500"
              placeholder="请输入密码"
              disabled={loading()}
            />
          </div>

          <button
            type="submit"
            disabled={loading()}
            class="w-full py-2 px-4 rounded bg-white text-black font-medium hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading() ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
