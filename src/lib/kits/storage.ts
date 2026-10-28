import { supabase } from "@/lib/supabase/client";
import type { ServiceLineKind } from "@/lib/service-orders/types";
import {
  kitMatchesOrder,
  serviceLineKindForCategory,
  type SupplyKit,
  type SupplyKitInput,
  type SupplyKitLine,
  type SupplyKitLineInput,
  type SupplyKitServiceType,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type ProductRef = {
  id: string;
  sku: string;
  name: string;
  model: string;
  category: string;
  unit: string;
  unit_price: number;
};

function mapLine(
  row: Record<string, unknown>,
  product?: ProductRef
): SupplyKitLine {
  return {
    id: String(row.id),
    kitId: String(row.kit_id),
    productId: String(row.product_id),
    productSku: String(product?.sku ?? ""),
    productName: String(product?.name ?? ""),
    productModel: String(product?.model ?? ""),
    productCategory: String(product?.category ?? ""),
    unit: String(product?.unit ?? "pieza"),
    unitPrice: Number(product?.unit_price ?? 0),
    quantity: Number(row.quantity ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    notes: String(row.notes ?? ""),
  };
}

function mapKit(
  row: Record<string, unknown>,
  lines: SupplyKitLine[]
): SupplyKit {
  const serviceType = String(row.service_type ?? "") as SupplyKitServiceType;
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    serviceType:
      serviceType === "diagnostico" ||
      serviceType === "preventivo" ||
      serviceType === "correctivo" ||
      serviceType === "instalacion"
        ? serviceType
        : "",
    equipmentKind: String(row.equipment_kind ?? ""),
    isActive: row.is_active !== false,
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    lines,
  };
}

async function loadProductsById(ids: string[]): Promise<Map<string, ProductRef>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, ProductRef>();
  if (!unique.length) return map;
  const { data, error } = await db
    .from("inventory_items")
    .select("id, sku, name, model, category, unit, unit_price")
    .in("id", unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(String(row.id), {
      id: String(row.id),
      sku: String(row.sku ?? ""),
      name: String(row.name ?? ""),
      model: String(row.model ?? ""),
      category: String(row.category ?? ""),
      unit: String(row.unit ?? "pieza"),
      unit_price: Number(row.unit_price ?? 0),
    });
  }
  return map;
}

async function nextKitCode(): Promise<string> {
  const prefix = "KIT-";
  const { data, error } = await db
    .from("supply_kits")
    .select("code")
    .ilike("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  let maxSeq = 0;
  for (const row of data ?? []) {
    const code = String(row.code ?? "");
    if (!code.startsWith(prefix)) continue;
    const seq = Number(code.slice(prefix.length));
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(6, "0")}`;
}

function normalizeLines(lines: SupplyKitLineInput[]): SupplyKitLineInput[] {
  const merged = new Map<string, SupplyKitLineInput>();
  for (const line of lines) {
    const productId = String(line.productId ?? "").trim();
    const quantity = Number(line.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    const prev = merged.get(productId);
    if (prev) {
      merged.set(productId, {
        productId,
        quantity: prev.quantity + quantity,
        notes: [prev.notes, line.notes].filter(Boolean).join(" ").trim(),
      });
    } else {
      merged.set(productId, {
        productId,
        quantity,
        notes: line.notes?.trim() ?? "",
      });
    }
  }
  return [...merged.values()];
}

async function replaceKitLines(kitId: string, lines: SupplyKitLineInput[]) {
  const normalized = normalizeLines(lines);
  const { error: delError } = await db
    .from("supply_kit_lines")
    .delete()
    .eq("kit_id", kitId);
  if (delError) throw new Error(delError.message);
  if (!normalized.length) return;
  const { error } = await db.from("supply_kit_lines").insert(
    normalized.map((line, index) => ({
      kit_id: kitId,
      product_id: line.productId,
      quantity: line.quantity,
      sort_order: index,
      notes: line.notes ?? "",
    }))
  );
  if (error) throw new Error(error.message);
}

export async function getSupplyKits(options?: {
  includeInactive?: boolean;
}): Promise<SupplyKit[]> {
  let query = db.from("supply_kits").select("*").order("name", { ascending: true });
  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    if (/supply_kits|schema cache|does not exist/i.test(error.message ?? "")) {
      return [];
    }
    throw new Error(error.message);
  }
  const kits = (data ?? []) as Record<string, unknown>[];
  if (!kits.length) return [];

  const kitIds = kits.map((row) => String(row.id));
  const { data: lineRows, error: lineError } = await db
    .from("supply_kit_lines")
    .select("*")
    .in("kit_id", kitIds)
    .order("sort_order", { ascending: true });
  if (lineError) throw new Error(lineError.message);

  const products = await loadProductsById(
    (lineRows ?? []).map((row: Record<string, unknown>) => String(row.product_id ?? ""))
  );

  const linesByKit = new Map<string, SupplyKitLine[]>();
  for (const row of lineRows ?? []) {
    const kitId = String(row.kit_id);
    const list = linesByKit.get(kitId) ?? [];
    list.push(mapLine(row, products.get(String(row.product_id))));
    linesByKit.set(kitId, list);
  }

  return kits.map((row) => mapKit(row, linesByKit.get(String(row.id)) ?? []));
}

export async function getSupplyKit(id: string): Promise<SupplyKit | null> {
  const kits = await getSupplyKits({ includeInactive: true });
  return kits.find((kit) => kit.id === id) ?? null;
}

export async function createSupplyKit(input: SupplyKitInput): Promise<SupplyKit> {
  const name = input.name.trim();
  if (!name) throw new Error("El kit necesita un nombre.");
  const code = await nextKitCode();
  const { data, error } = await db
    .from("supply_kits")
    .insert({
      code,
      name,
      description: input.description?.trim() ?? "",
      service_type: input.serviceType ?? "",
      equipment_kind: input.equipmentKind ?? "",
      is_active: input.isActive !== false,
      created_by: input.createdBy ?? "",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await replaceKitLines(String(data.id), input.lines);
  const created = await getSupplyKit(String(data.id));
  if (!created) throw new Error("No se pudo recargar el kit.");
  return created;
}

export async function updateSupplyKit(
  id: string,
  patch: Partial<SupplyKitInput>
): Promise<SupplyKit> {
  const payload: Record<string, unknown> = {};
  if (patch.name != null) payload.name = patch.name.trim();
  if (patch.description != null) payload.description = patch.description.trim();
  if (patch.serviceType != null) payload.service_type = patch.serviceType;
  if (patch.equipmentKind != null) payload.equipment_kind = patch.equipmentKind;
  if (patch.isActive != null) payload.is_active = patch.isActive;
  if (Object.keys(payload).length) {
    const { error } = await db.from("supply_kits").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  }
  if (patch.lines) {
    await replaceKitLines(id, patch.lines);
  }
  const updated = await getSupplyKit(id);
  if (!updated) throw new Error("No se pudo recargar el kit.");
  return updated;
}

export async function duplicateSupplyKit(
  id: string,
  createdBy: string
): Promise<SupplyKit> {
  const kit = await getSupplyKit(id);
  if (!kit) throw new Error("No se encontró el kit.");
  return createSupplyKit({
    name: `${kit.name} (copia)`,
    description: kit.description,
    serviceType: kit.serviceType,
    equipmentKind: kit.equipmentKind,
    createdBy,
    lines: kit.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      notes: line.notes,
    })),
  });
}

export async function deleteSupplyKit(id: string): Promise<void> {
  const { error } = await db.from("supply_kits").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type KitServiceLine = {
  lineKind: ServiceLineKind;
  productId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes: string;
};

export function kitToServiceLines(kit: SupplyKit): KitServiceLine[] {
  return kit.lines
    .filter((line) => line.productId && line.quantity > 0)
    .map((line) => ({
      lineKind: serviceLineKindForCategory(line.productCategory),
      productId: line.productId,
      description: line.productName || line.productSku,
      quantity: line.quantity,
      unit: line.unit || "pieza",
      unitPrice: line.unitPrice,
      notes: line.notes,
    }));
}

export function suggestedSupplyKits(
  kits: SupplyKit[],
  order: Parameters<typeof kitMatchesOrder>[1]
) {
  const active = kits.filter((kit) => kit.isActive && kit.lines.length);
  const matching = active.filter((kit) => kitMatchesOrder(kit, order));
  const rest = active.filter((kit) => !matching.some((item) => item.id === kit.id));
  return { matching, rest };
}
