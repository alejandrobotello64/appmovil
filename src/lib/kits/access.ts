import {
  INVENTORY_TAB_MODULES,
  permissionKey,
  type PermissionKey,
  type WarehouseModule,
} from "@/lib/auth/permissions";

export function canViewSupplyKits(
  canView: (module: WarehouseModule) => boolean
) {
  return (
    INVENTORY_TAB_MODULES.some((module) => canView(module)) ||
    canView("ordenes_servicio") ||
    canView("plantillas_checklist")
  );
}

export function canWriteSupplyKits(can: (key: PermissionKey) => boolean) {
  return (
    INVENTORY_TAB_MODULES.some(
      (module) =>
        can(permissionKey(module, "create")) || can(permissionKey(module, "edit"))
    ) ||
    can("ordenes_servicio.create") ||
    can("ordenes_servicio.edit") ||
    can("plantillas_checklist.create") ||
    can("plantillas_checklist.edit")
  );
}

export function canDeleteSupplyKits(can: (key: PermissionKey) => boolean) {
  return (
    INVENTORY_TAB_MODULES.some((module) => can(permissionKey(module, "delete"))) ||
    can("ordenes_servicio.delete") ||
    can("plantillas_checklist.delete")
  );
}
