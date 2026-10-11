import type { ServiceLineKind, ServiceType } from "@/lib/service-orders/types";
import {
  EQUIPMENT_KINDS,
  SERVICE_TYPES,
  equipmentKindLabel,
  serviceTypeLabel,
} from "@/lib/service-orders/types";

export type SupplyKitServiceType = ServiceType | "";

export type SupplyKitLine = {
  id: string;
  kitId: string;
  productId: string;
  productSku: string;
  productName: string;
  productCategory: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  sortOrder: number;
  notes: string;
};

export type SupplyKit = {
  id: string;
  code: string;
  name: string;
  description: string;
  serviceType: SupplyKitServiceType;
  equipmentKind: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: SupplyKitLine[];
};

export type SupplyKitLineInput = {
  productId: string;
  quantity: number;
  notes?: string;
};

export type SupplyKitInput = {
  name: string;
  description?: string;
  serviceType?: SupplyKitServiceType;
  equipmentKind?: string;
  isActive?: boolean;
  createdBy?: string;
  lines: SupplyKitLineInput[];
};

export const KIT_SERVICE_TYPE_OPTIONS: {
  id: SupplyKitServiceType;
  label: string;
}[] = [
  { id: "", label: "Cualquier tipo de servicio" },
  ...SERVICE_TYPES,
];

export const KIT_EQUIPMENT_KIND_OPTIONS: { id: string; label: string }[] = [
  { id: "", label: "Cualquier equipo" },
  ...EQUIPMENT_KINDS,
];

export function kitServiceTypeLabel(type: string) {
  if (!type) return "Cualquier servicio";
  return serviceTypeLabel(type);
}

export function kitEquipmentKindLabel(kind: string) {
  if (!kind) return "Cualquier equipo";
  return equipmentKindLabel(kind);
}

export function serviceLineKindForCategory(category: string): ServiceLineKind {
  if (category === "medicamentos") return "medicamentos";
  if (category === "refacciones") return "refacciones";
  if (category === "accesorios") return "accesorios";
  return "insumos";
}

export function kitMatchesOrder(
  kit: Pick<SupplyKit, "serviceType" | "equipmentKind">,
  order: {
    serviceType?: string;
    equipmentKind?: string;
    equipmentName?: string;
    equipmentBrand?: string;
    equipmentModel?: string;
  }
) {
  if (kit.serviceType && order.serviceType && kit.serviceType !== order.serviceType) {
    return false;
  }
  if (kit.equipmentKind && order.equipmentKind && kit.equipmentKind !== order.equipmentKind) {
    return false;
  }
  return true;
}
