import { Outlet, createRootRouteWithContext } from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";

import Header from "@/components/header";
import { AuthProvider } from "@/contexts/auth-context";

export interface RouterContext {}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <div class="grid grid-rows-[auto_1fr] h-svh">
        <Header />
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </AuthProvider>
  );
}
