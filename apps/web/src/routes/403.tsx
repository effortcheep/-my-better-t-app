import { createFileRoute, useNavigate } from "@tanstack/solid-router";

export const Route = createFileRoute("/403")({
  component: ForbiddenPage,
});

function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div class="flex items-center justify-center min-h-[calc(100vh-3rem)]">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-neutral-400 mb-4">403</h1>
        <p class="text-xl text-neutral-300 mb-6">您没有权限访问此页面</p>
        <div class="flex gap-4 justify-center">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            class="px-4 py-2 rounded bg-white text-black font-medium hover:bg-neutral-200 transition-colors"
          >
            返回首页
          </button>
          <button
            onClick={() => window.history.back()}
            class="px-4 py-2 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            返回上一页
          </button>
        </div>
      </div>
    </div>
  );
}
