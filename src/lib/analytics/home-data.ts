import type { WarehouseModule } from "@/lib/auth/permissions";
import { getBiomedicalInstruments } from "@/lib/biomedical-instruments/storage";
import type { BiomedicalInstrument } from "@/lib/biomedical-instruments/types";
import { getClientEquipment, getClients } from "@/lib/clients/storage";
import type { Client, ClientEquipment } from "@/lib/clients/types";
import { getCompanyVehicles } from "@/lib/fleet/storage";
import type { CompanyVehicle } from "@/lib/fleet/types";
import { getInventoryHolds } from "@/lib/holds/storage";
import type { InventoryHold } from "@/lib/holds/types";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { getQualitySurveys } from "@/lib/quality/storage";
import type { QualitySurvey } from "@/lib/quality/types";
import { getQuotes } from "@/lib/quotes/storage";
import type { Quote } from "@/lib/quotes/types";
import { getCatalogDocuments } from "@/lib/sales-catalog/storage";
import type { CatalogDocument } from "@/lib/sales-catalog/types";
import type { ServiceOrderStatus, ServiceType } from "@/lib/service-orders/types";
import { supabase } from "@/lib/supabase/client";
import { getTenders } from "@/lib/tenders/storage";
import type { Tender } from "@/lib/tenders/types";

export const HOME_AREAS = [
  { id: "servicio", label: "Biomédica", modules: ["ordenes_servicio"] },
  { id: "ventas", label: "Ventas", modules: ["cotizaciones"] },
  { id: "licitaciones", label: "Licitaciones", modules: ["licitaciones"] },
  {
    id: "inventario",
    label: "Almacén",
    modules: ["dashboard", "insumos", "medicamentos", "refacciones", "accesorios", "reactivos", "equipo"],
  },
  { id: "apartados", label: "Apartados", modules: ["apartados"] },
  { id: "registros", label: "Registros sanitarios", modules: ["registros_sanitarios"] },
  { id: "instrumentos", label: "Instrumentos", modules: ["instrumentos"] },
  { id: "calidad", label: "Calidad", modules: ["calidad"] },
  { id: "clientes", label: "Clientes", modules: ["clientes"] },
  { id: "flotilla", label: "Flotilla", modules: ["flotilla"] },
] as const satisfies readonly { id: string; label: string; modules: readonly WarehouseModule[] }[];

export type HomeArea = (typeof HOME_AREAS)[number]["id"];

export function homeAreaLabel(area: HomeArea) {
  return HOME_AREAS.find((item) => item.id === area)?.label ?? area;
}

export function allowedHomeAreas(canView: (module: WarehouseModule) => boolean): HomeArea[] {
  return HOME_AREAS.filter((area) =>
    (area.modules as readonly WarehouseModule[]).some((module) => canView(module))
  ).map((area) => area.id);
}

/** Orden de servicio sin checklist, imágenes ni eventos: solo lo que usa el tablero. */
export type ServiceOrderLite = {
  id: string;
  folio: string;
  orderKind: string;
  status: ServiceOrderStatus;
  priority: "normal" | "urgente";
  serviceType: ServiceType;
  clientId: string | null;
  clientName: string;
  equipmentName: string;
  equipmentBrand: string;
  equipmentModel: string;
  technician: string;
  receptionAt: string;
  promisedAt: string;
  deliveredAt: string;
  total: number;
  currency: string;
  underWarranty: boolean;
  createdAt: string;
};

const PAGE_SIZE = 1000;

async function getServiceOrdersLite(): Promise<ServiceOrderLite[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("service_orders")
      .select(
        "id, folio, order_kind, status, priority, service_type, client_id, client_name, equipment_name, equipment_brand, equipment_model, technician, reception_at, promised_at, delivered_at, total, currency, under_warranty, created_at"
      )
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  const text = (value: unknown) => (value == null ? "" : String(value));
  return rows.map((row) => ({
    id: text(row.id),
    folio: text(row.folio),
    orderKind: text(row.order_kind) || "servicio",
    status: (text(row.status) || "borrador") as ServiceOrderStatus,
    priority: text(row.priority) === "urgente" ? "urgente" : "normal",
    serviceType: (text(row.service_type) || "diagnostico") as ServiceType,
    clientId: row.client_id ? text(row.client_id) : null,
    clientName: text(row.client_name),
    equipmentName: text(row.equipment_name),
    equipmentBrand: text(row.equipment_brand),
    equipmentModel: text(row.equipment_model),
    technician: text(row.technician),
    receptionAt: text(row.reception_at),
    promisedAt: text(row.promised_at),
    deliveredAt: text(row.delivered_at),
    total: Number(row.total ?? 0) || 0,
    currency: text(row.currency),
    underWarranty: Boolean(row.under_warranty),
    createdAt: text(row.created_at),
  }));
}

export type HomeData = {
  loadedAt: number;
  loaded: HomeArea[];
  failed: HomeArea[];
  serviceOrders: ServiceOrderLite[];
  quotes: Quote[];
  tenders: Tender[];
  inventory: InventoryItem[];
  holds: InventoryHold[];
  sanitaryDocs: CatalogDocument[];
  instruments: BiomedicalInstrument[];
  surveys: QualitySurvey[];
  clients: Client[];
  clientEquipment: ClientEquipment[];
  vehicles: CompanyVehicle[];
};

const LOADERS: { [K in HomeArea]: () => Promise<Partial<HomeData>> } = {
  servicio: async () => ({ serviceOrders: await getServiceOrdersLite() }),
  ventas: async () => ({ quotes: await getQuotes() }),
  licitaciones: async () => ({ tenders: await getTenders() }),
  inventario: async () => ({ inventory: await getInventoryItems() }),
  apartados: async () => ({ holds: await getInventoryHolds() }),
  registros: async () => ({ sanitaryDocs: await getCatalogDocuments("almacen") }),
  instrumentos: async () => ({ instruments: await getBiomedicalInstruments() }),
  calidad: async () => ({ surveys: await getQualitySurveys() }),
  clientes: async () => {
    const [clients, clientEquipment] = await Promise.all([getClients(), getClientEquipment()]);
    return { clients, clientEquipment };
  },
  flotilla: async () => ({ vehicles: await getCompanyVehicles() }),
};

/** Carga en paralelo solo las áreas permitidas; si una falla, las demás siguen. */
export async function loadHomeData(areas: HomeArea[]): Promise<HomeData> {
  const results = await Promise.allSettled(areas.map((area) => LOADERS[area]()));
  const data: HomeData = {
    loadedAt: Date.now(),
    loaded: [],
    failed: [],
    serviceOrders: [],
    quotes: [],
    tenders: [],
    inventory: [],
    holds: [],
    sanitaryDocs: [],
    instruments: [],
    surveys: [],
    clients: [],
    clientEquipment: [],
    vehicles: [],
  };
  results.forEach((result, index) => {
    const area = areas[index];
    if (result.status === "fulfilled") {
      Object.assign(data, result.value);
      data.loaded.push(area);
    } else {
      console.error(`Error cargando ${area} para el tablero:`, result.reason);
      data.failed.push(area);
    }
  });
  return data;
}
