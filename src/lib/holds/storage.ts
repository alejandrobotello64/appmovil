import { supabase } from "@/lib/supabase/client";
import { applyStockMovement } from "@/lib/warehouse/stock";
import type {
  HoldStatus,
  InventoryHold,
  InventoryHoldInput,
  InventoryHoldLine,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function mapLine(
  row: Record<string, unknown>,
  product?: { sku?: string; name?: string }
): InventoryHoldLine {
  return {
    id: String(row.id),
    holdId: String(row.hold_id),
    productId: String(row.product_id),
    productSku: String(product?.sku ?? row.product_sku ?? ""),
    productName: String(product?.name ?? row.product_name ?? ""),
    quantity: Number(row.quantity),
    notes: String(row.notes ?? ""),
  };
}

function mapHold(
  row: Record<string, unknown>,
  lines: InventoryHoldLine[]
): InventoryHold {
  return {
    id: String(row.id),
    folio: String(row.folio),
    projectName: String(row.project_name ?? ""),
    clientName: String(row.client_name ?? ""),
    clientCity: String(row.client_city ?? ""),
    clientState: String(row.client_state ?? ""),
    neededBy: row.needed_by ? String(row.needed_by).slice(0, 10) : "",
    status: String(row.status ?? "activo") as HoldStatus,
    notes: String(row.notes ?? ""),
    createdBy: String(row.created_by ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lines,
  };
}

async function nextHoldFolio() {
  const year = new Date().getFullYear();
  const prefix = `APR-${year}-`;
  const { data, error } = await db
    .from("inventory_holds")
    .select("folio")
    .like("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.folio as string | undefined;
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

export async function getReservedQuantities(): Promise<Map<string, number>> {
  const { data: activeHolds, error: holdsError } = await db
    .from("inventory_holds")
    .select("id")
    .eq("status", "activo");
  if (holdsError) throw new Error(holdsError.message);

  const holdIds = (activeHolds ?? []).map(
    (row: { id: string }) => row.id
  );
  const map = new Map<string, number>();
  if (holdIds.length === 0) return map;

  const { data: lines, error } = await db
    .from("inventory_hold_lines")
    .select("product_id, quantity")
    .in("hold_id", holdIds);
  if (error) throw new Error(error.message);

  for (const row of lines ?? []) {
    const productId = String(row.product_id);
    map.set(productId, (map.get(productId) ?? 0) + Number(row.quantity));
  }
  return map;
}

export async function getProductAvailableQty(productId: string): Promise<number> {
  const { data, error } = await db.rpc("product_available_qty", {
    p_product_id: productId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function getInventoryHolds(): Promise<InventoryHold[]> {
  const { data: holds, error } = await db
    .from("inventory_holds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const holdRows = holds ?? [];
  if (holdRows.length === 0) return [];

  const holdIds = holdRows.map((row: Record<string, unknown>) => row.id);
  const { data: lines, error: linesError } = await db
    .from("inventory_hold_lines")
    .select("*, product:inventory_items(sku, name)")
    .in("hold_id", holdIds);
  if (linesError) throw new Error(linesError.message);

  const linesByHold = new Map<string, InventoryHoldLine[]>();
  for (const row of lines ?? []) {
    const holdId = String(row.hold_id);
    const list = linesByHold.get(holdId) ?? [];
    list.push(
      mapLine(row, {
        sku: row.product?.sku,
        name: row.product?.name,
      })
    );
    linesByHold.set(holdId, list);
  }

  return holdRows.map((row: Record<string, unknown>) =>
    mapHold(row, linesByHold.get(String(row.id)) ?? [])
  );
}

export async function createInventoryHold(
  input: InventoryHoldInput
): Promise<InventoryHold> {
  if (!input.projectName.trim()) {
    throw new Error("El nombre del proyecto es obligatorio.");
  }
  if (!input.lines.length) {
    throw new Error("Agrega al menos un artículo al apartado.");
  }

  const totals = new Map<string, number>();
  for (const line of input.lines) {
    if (line.quantity <= 0) {
      throw new Error("La cantidad apartada debe ser mayor a 0.");
    }
    totals.set(
      line.productId,
      (totals.get(line.productId) ?? 0) + line.quantity
    );
  }

  for (const [productId, quantity] of totals) {
    const available = await getProductAvailableQty(productId);
    if (quantity > available) {
      throw new Error(
        `No hay suficiente disponible para apartar. Disponible: ${available}.`
      );
    }
  }

  const folio = await nextHoldFolio();
  const { data: hold, error } = await db
    .from("inventory_holds")
    .insert({
      folio,
      project_name: input.projectName.trim(),
      client_name: (input.clientName ?? "").trim(),
      client_city: (input.clientCity ?? "").trim(),
      client_state: (input.clientState ?? "").trim(),
      needed_by: input.neededBy || null,
      notes: (input.notes ?? "").trim(),
      created_by: (input.createdBy ?? "").trim(),
      status: "activo",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { data: lines, error: linesError } = await db
    .from("inventory_hold_lines")
    .insert(
      input.lines.map((line) => ({
        hold_id: hold.id,
        product_id: line.productId,
        quantity: line.quantity,
        notes: (line.notes ?? "").trim(),
      }))
    )
    .select("*, product:inventory_items(sku, name)");
  if (linesError) {
    await db.from("inventory_holds").delete().eq("id", hold.id);
    throw new Error(linesError.message);
  }

  return mapHold(
    hold,
    (lines ?? []).map((row: Record<string, unknown>) =>
      mapLine(row, {
        sku: (row.product as { sku?: string } | undefined)?.sku,
        name: (row.product as { name?: string } | undefined)?.name,
      })
    )
  );
}

export async function setInventoryHoldStatus(
  id: string,
  status: HoldStatus
): Promise<void> {
  const { error } = await db
    .from("inventory_holds")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Libera el apartado: el stock vuelve a estar disponible sin salir del almacén. */
export async function releaseInventoryHold(id: string): Promise<void> {
  await setInventoryHoldStatus(id, "liberado");
}

export async function cancelInventoryHold(id: string): Promise<void> {
  await setInventoryHoldStatus(id, "cancelado");
}

/**
 * Entrega el apartado: genera salidas reales y marca el apartado como entregado.
 */
export async function fulfillInventoryHold(
  hold: InventoryHold,
  createdBy: string
): Promise<void> {
  if (hold.status !== "activo") {
    throw new Error("Solo se pueden entregar apartados activos.");
  }
  if (!hold.lines.length) {
    throw new Error("El apartado no tiene líneas.");
  }

  for (const line of hold.lines) {
    await applyStockMovement({
      productId: line.productId,
      movementType: "salida",
      quantity: line.quantity,
      createdBy,
      reason: "Apartado entregado a proyecto",
      note: `${hold.folio} · ${hold.projectName}${
        hold.clientName ? ` · ${hold.clientName}` : ""
      }${line.notes ? ` · ${line.notes}` : ""}`,
    });
  }

  await setInventoryHoldStatus(hold.id, "entregado");
}
