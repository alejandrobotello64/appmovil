"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getRawSession,
  parseSession,
  SESSION_CHANGE_EVENT,
} from "@/lib/auth";
import {
  canViewModule,
  hasPermission,
  normalizeRole,
  permissionKey,
  type PermissionAction,
  type PermissionKey,
  type WarehouseModule,
} from "@/lib/auth/permissions";

function subscribe(callback: () => void) {
  window.addEventListener(SESSION_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot() {
  return null;
}

export function useSessionAccess() {
  const raw = useSyncExternalStore(subscribe, getRawSession, getServerSnapshot);

  return useMemo(() => {
    const session = parseSession(raw);
    const subject = {
      role: session?.role ?? null,
      permissionOverrides: session?.permissionOverrides ?? {},
    };
    return {
      session,
      ready: session !== null,
      role: normalizeRole(session?.role),
      can: (key: PermissionKey) => hasPermission(subject, key),
      canView: (module: WarehouseModule) => canViewModule(subject, module),
    };
  }, [raw]);
}

export function usePermissions(module: WarehouseModule) {
  const access = useSessionAccess();

  return useMemo(() => {
    const can = (action: PermissionAction) =>
      access.can(permissionKey(module, action));
    const canCreate = can("create");
    const canEdit = can("edit");
    const canDelete = can("delete");
    return {
      role: access.role,
      ready: access.ready,
      can,
      canView: can("view"),
      canCreate,
      canEdit,
      canDelete,
      canExport: can("export"),
      canImport: can("import"),
      canApprove: can("approve"),
      canWrite: canCreate || canEdit || canDelete,
    };
  }, [access, module]);
}
