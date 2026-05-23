import { Link, useNavigate } from "@tanstack/solid-router";
import { For, Show, createSignal } from "solid-js";
import { LogOut, User, ChevronDown } from "lucide-solid";

import { useAuth } from "@/contexts/auth-context";
import PermissionGuard from "@/components/permission-guard";

export default function Header() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = createSignal(false);

  const handleLogout = () => {
    auth.logout();
    navigate({ to: "/login" });
  };

  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "仪表盘" },
  ];

  return (
    <div>
      <div class="flex flex-row items-center justify-between px-2 py-1">
        <nav class="flex gap-4 text-lg">
          <For each={links}>{(link) => <Link to={link.to}>{link.label}</Link>}</For>
          <PermissionGuard permission="task:list">
            <Link to="/tasks">任务管理</Link>
          </PermissionGuard>
          <PermissionGuard permission="user:list">
            <Link to="/admins">管理员</Link>
          </PermissionGuard>
          <PermissionGuard permission="role:list">
            <Link to="/roles">角色管理</Link>
          </PermissionGuard>
        </nav>

        <div class="flex items-center gap-2">
          <Show
            when={auth.isAuthenticated && auth.user}
            fallback={
              <Link
                to="/login"
                class="text-sm px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-800"
              >
                登录
              </Link>
            }
          >
            <div class="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen())}
                class="flex items-center gap-2 text-sm px-3 py-1 rounded hover:bg-neutral-800 transition-colors"
              >
                <User size={16} />
                <span>{auth.user?.displayName}</span>
                <ChevronDown size={14} />
              </button>

              <Show when={menuOpen()}>
                <div class="absolute right-0 top-full mt-1 w-40 rounded border border-neutral-700 bg-neutral-900 shadow-lg z-50">
                  <button
                    onClick={handleLogout}
                    class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-neutral-800 transition-colors"
                  >
                    <LogOut size={14} />
                    登出
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <hr />
    </div>
  );
}
