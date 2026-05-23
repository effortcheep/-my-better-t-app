import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import tasks from "@/routes/tasks/tasks.index";
import health from "@/routes/health/health.index";
import auth from "@/routes/auth/auth.index";
import userAuth from "@/routes/user-auth/user-auth.index";
import admins from "@/routes/admins/admins.index";
import rolesRoutes from "@/routes/roles/roles.index";
import permissionsRoutes from "@/routes/permissions/permissions.index";

const app = createApp();

configureOpenAPI(app);

const routes = [index, tasks, health, auth, userAuth, admins, rolesRoutes, permissionsRoutes] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = (typeof routes)[number];

export default app;
