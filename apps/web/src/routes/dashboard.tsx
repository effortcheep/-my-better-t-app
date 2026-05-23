import { createFileRoute, redirect } from "@tanstack/solid-router";
import { isAuthenticated } from "@/lib/auth-api";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div class="p-4">
      <h1 class="text-2xl font-bold mb-4">仪表盘</h1>
      <p class="text-neutral-400">欢迎使用管理系统</p>
    </div>
  );
}
