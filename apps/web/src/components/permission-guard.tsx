import { type ParentComponent, Show } from "solid-js";
import { usePermission } from "@/hooks/use-permission";

interface PermissionGuardProps {
  permission: string | string[];
  fallback?: any;
}

const PermissionGuard: ParentComponent<PermissionGuardProps> = (props) => {
  const { hasPermission, hasAnyPermission } = usePermission();

  const allowed = () => {
    if (Array.isArray(props.permission)) {
      return hasAnyPermission(props.permission);
    }
    return hasPermission(props.permission);
  };

  return (
    <Show when={allowed()} fallback={props.fallback}>
      {props.children}
    </Show>
  );
};

export default PermissionGuard;
