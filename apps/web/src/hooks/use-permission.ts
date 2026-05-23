import { useAuth } from "@/contexts/auth-context";

export function usePermission() {
  const auth = useAuth();

  const hasPermission = (permission: string): boolean => {
    const user = auth.user;
    if (!user) return false;
    if (user.role.name === "super_admin") return true;
    return user.permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    const user = auth.user;
    if (!user) return false;
    if (user.role.name === "super_admin") return true;
    return perms.some((p) => user.permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]): boolean => {
    const user = auth.user;
    if (!user) return false;
    if (user.role.name === "super_admin") return true;
    return perms.every((p) => user.permissions.includes(p));
  };

  return { hasPermission, hasAnyPermission, hasAllPermissions };
}
