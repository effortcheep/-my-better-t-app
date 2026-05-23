import { db } from "@my-better-t-app/db";
import { roles, permissions, rolePermissions, admins } from "@my-better-t-app/db/schema";
import { env } from "@my-better-t-app/env/server";
import bcrypt from "bcryptjs";

const PERMISSIONS_DATA = [
  { code: "task:list", name: "查看任务列表", module: "task", type: "api" },
  { code: "task:create", name: "创建任务", module: "task", type: "api" },
  { code: "task:update", name: "更新任务", module: "task", type: "api" },
  { code: "task:delete", name: "删除任务", module: "task", type: "api" },
  { code: "user:list", name: "查看管理员列表", module: "user", type: "api" },
  { code: "user:create", name: "创建管理员", module: "user", type: "api" },
  { code: "user:update", name: "更新管理员", module: "user", type: "api" },
  { code: "user:delete", name: "删除管理员", module: "user", type: "api" },
  { code: "role:list", name: "查看角色列表", module: "role", type: "api" },
  { code: "role:create", name: "创建角色", module: "role", type: "api" },
  { code: "role:update", name: "更新角色", module: "role", type: "api" },
  { code: "role:delete", name: "删除角色", module: "role", type: "api" },
  { code: "system:dashboard", name: "访问系统仪表盘", module: "system", type: "ui" },
];

const ROLES_DATA = [
  { name: "super_admin", description: "超级管理员，拥有全部权限", isSystem: true },
  { name: "editor", description: "编辑员，可管理任务", isSystem: true },
  { name: "viewer", description: "访客，只读权限", isSystem: true },
];

export async function seed() {
  console.log("Seeding database...");

  // Insert permissions
  for (const perm of PERMISSIONS_DATA) {
    await db.insert(permissions).values(perm).onConflictDoNothing({ target: permissions.code });
  }
  console.log(`Seeded ${PERMISSIONS_DATA.length} permissions`);

  // Insert roles
  for (const role of ROLES_DATA) {
    await db.insert(roles).values(role).onConflictDoNothing({ target: roles.name });
  }
  console.log(`Seeded ${ROLES_DATA.length} roles`);

  // Get all permissions and roles
  const allPermissions = await db.query.permissions.findMany();
  const allRoles = await db.query.roles.findMany();

  const superAdminRole = allRoles.find((r) => r.name === "super_admin")!;
  const editorRole = allRoles.find((r) => r.name === "editor")!;
  const viewerRole = allRoles.find((r) => r.name === "viewer")!;

  const permMap = new Map(allPermissions.map((p) => [p.code, p.id]));

  // Assign all permissions to super_admin
  for (const perm of allPermissions) {
    await db
      .insert(rolePermissions)
      .values({ roleId: superAdminRole.id, permissionId: perm.id })
      .onConflictDoNothing();
  }

  // Assign task:* + system:dashboard to editor
  const editorPermCodes = [
    "task:list",
    "task:create",
    "task:update",
    "task:delete",
    "system:dashboard",
  ];
  for (const code of editorPermCodes) {
    const pid = permMap.get(code);
    if (pid) {
      await db
        .insert(rolePermissions)
        .values({ roleId: editorRole.id, permissionId: pid })
        .onConflictDoNothing();
    }
  }

  // Assign task:list + system:dashboard to viewer
  const viewerPermCodes = ["task:list", "system:dashboard"];
  for (const code of viewerPermCodes) {
    const pid = permMap.get(code);
    if (pid) {
      await db
        .insert(rolePermissions)
        .values({ roleId: viewerRole.id, permissionId: pid })
        .onConflictDoNothing();
    }
  }
  console.log("Assigned permissions to roles");

  // Create default admin
  const existingAdmin = await db.query.admins.findFirst({
    where(fields, operators) {
      return operators.eq(fields.username, env.DEFAULT_ADMIN_USERNAME);
    },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(env.DEFAULT_ADMIN_PASSWORD, env.BCRYPT_COST_FACTOR);
    await db.insert(admins).values({
      username: env.DEFAULT_ADMIN_USERNAME,
      passwordHash,
      displayName: "超级管理员",
      roleId: superAdminRole.id,
    });
    console.log("Created default admin user");
  }

  console.log("Seed completed!");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
