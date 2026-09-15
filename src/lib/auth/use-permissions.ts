"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";
import {
  canViewModule,
  canWriteModule,
  normalizeRole,
  type AppRole,
  type WarehouseModule,
} from "@/lib/auth/permissions";

export function usePermissions(module: WarehouseModule) {
  const [role, setRole] = useState<AppRole>("direccion");

  useEffect(() => {
    setRole(normalizeRole(getSession()?.role));
  }, []);

  return {
    role,
    canView: canViewModule(role, module),
    canWrite: canWriteModule(role, module),
  };
}
