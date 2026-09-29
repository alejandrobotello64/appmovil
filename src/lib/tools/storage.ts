import { supabase } from "@/lib/supabase/client";
import { findStaffProfile } from "@/lib/users/staff";
import {
  lineOutstanding,
  TOOL_OUT_STATUSES,
  type CreateToolRequestInput,
  type DeliverToolRequestInput,
  type PersonSnapshot,
  type ReturnToolRequestInput,
  type Tool,
  type ToolCategory,
  type ToolCondition,
  type ToolInput,
  type ToolRequest,
  type ToolRequestEvent,
  type ToolRequestLine,
  type ToolRequestStatus,
  type ToolReturnDetails,
  type ToolWithAvailability,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Row = Record<string, unknown>;

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const num = (value: unknown) => Number(value ?? 0) || 0;

function mapTool(row: Row): Tool {
  return {
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    category: str(row.category || "otro") as ToolCategory,
    brand: str(row.brand),
    model: str(row.model),
    serialNumber: str(row.serial_number),
    description: str(row.description),
    location: str(row.location),
    quantityTotal: num(row.quantity_total),
    condition: str(row.condition || "bueno") as ToolCondition,
    isActive: row.is_active !== false,
    notes: str(row.notes),
    createdBy: str(row.created_by),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function mapLine(row: Row): ToolRequestLine {
  return {
    id: str(row.id),
    requestId: str(row.request_id),
    toolId: row.tool_id ? str(row.tool_id) : null,
    toolCode: str(row.tool_code),
    toolName: str(row.tool_name),
    toolBrand: str(row.tool_brand),
    toolModel: str(row.tool_model),
    toolSerial: str(row.tool_serial),
    quantityRequested: num(row.quantity_requested),
    quantityDelivered: num(row.quantity_delivered),
    quantityReturned: num(row.quantity_returned),
    quantityLost: num(row.quantity_lost),
    conditionOut: str(row.condition_out),
    conditionIn: str(row.condition_in),
    notes: str(row.notes),
    sortOrder: num(row.sort_order),
  };
}

function mapEvent(row: Row): ToolRequestEvent {
  return {
    id: str(row.id),
    requestId: str(row.request_id),
    eventType: str(row.event_type),
    message: str(row.message),
    details: (row.details as ToolRequestEvent["details"]) ?? {},
    actor: str(row.actor),
    createdAt: str(row.created_at),
  };
}

function person(row: Row, prefix: "requester" | "deliverer", usernameKey: string): PersonSnapshot {
  return {
    username: str(row[usernameKey]),
    name: str(row[`${prefix}_name`]),
    jobTitle: str(row[`${prefix}_job_title`]),
    department: str(row[`${prefix}_department`]),
    employeeNumber: str(row[`${prefix}_employee_number`]),
    phone: prefix === "requester" ? str(row.requester_phone) : "",
  };
}

function mapRequest(row: Row, lines: ToolRequestLine[], events: ToolRequestEvent[]): ToolRequest {
  return {
    id: str(row.id),
    folio: str(row.folio),
    status: str(row.status || "solicitada") as ToolRequestStatus,
    purpose: str(row.purpose),
    serviceOrderId: row.service_order_id ? str(row.service_order_id) : null,
    serviceOrderFolio: str(row.service_order_folio),
    clientName: str(row.client_name),
    expectedReturnAt: str(row.expected_return_at).slice(0, 10),
    notes: str(row.notes),
    requester: person(row, "requester", "requested_by"),
    requestedAt: str(row.requested_at || row.created_at),
    deliverer: person(row, "deliverer", "delivered_by"),
    deliveredAt: str(row.delivered_at),
    deliveryNotes: str(row.delivery_notes),
    returnedAt: str(row.returned_at),
    closedBy: str(row.closed_by),
    closedReason: str(row.closed_reason),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
    lines: [...lines].sort((a, b) => a.sortOrder - b.sortOrder),
    events: [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}

/** Completa puesto, departamento y número de empleado desde la ficha del colaborador. */
export async function resolvePerson(session: {
  username: string;
  fullName: string | null;
}): Promise<PersonSnapshot> {
  const name = (session.fullName ?? "").trim() || session.username;
  const profile =
    (await findStaffProfile(name)) ??
    (name !== session.username ? await findStaffProfile(session.username) : null);
  return {
    username: session.username,
    name: profile?.fullName || name,
    jobTitle: profile?.jobTitle ?? "",
    department: profile?.department ?? "",
    employeeNumber: profile?.employeeNumber ?? "",
    phone: profile?.phone ?? "",
  };
}

// ---------- Catálogo ----------

async function outstandingByTool(): Promise<Map<string, number>> {
  const { data: open, error } = await db
    .from("tool_requests")
    .select("id")
    .in("status", TOOL_OUT_STATUSES);
  if (error) throw new Error(error.message);
  const ids = (open ?? []).map((row: Row) => row.id);
  const result = new Map<string, number>();
  if (!ids.length) return result;
  const { data: lines, error: linesError } = await db
    .from("tool_request_lines")
    .select("tool_id, quantity_delivered, quantity_returned, quantity_lost")
    .in("request_id", ids);
  if (linesError) throw new Error(linesError.message);
  for (const row of (lines ?? []) as Row[]) {
    if (!row.tool_id) continue;
    const out = lineOutstanding({
      quantityDelivered: num(row.quantity_delivered),
      quantityReturned: num(row.quantity_returned),
      quantityLost: num(row.quantity_lost),
    });
    const key = str(row.tool_id);
    result.set(key, (result.get(key) ?? 0) + out);
  }
  return result;
}

export async function getTools(options?: { includeInactive?: boolean }): Promise<ToolWithAvailability[]> {
  let query = db.from("tools").select("*").order("name", { ascending: true });
  if (!options?.includeInactive) query = query.eq("is_active", true);
  const [{ data, error }, out] = await Promise.all([query, outstandingByTool()]);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => {
    const tool = mapTool(row);
    const quantityOut = out.get(tool.id) ?? 0;
    const usable = tool.isActive && tool.condition !== "baja" ? tool.quantityTotal : 0;
    return { ...tool, quantityOut, quantityAvailable: Math.max(0, usable - quantityOut) };
  });
}

async function nextToolCode() {
  const { data, error } = await db
    .from("tools")
    .select("code")
    .like("code", "HER-%")
    .order("code", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = str(data?.[0]?.code);
  const seq = last ? Number(last.slice(4)) + 1 : 1;
  return `HER-${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

function toolRow(input: ToolInput) {
  return {
    name: input.name.trim(),
    category: input.category,
    brand: input.brand.trim(),
    model: input.model.trim(),
    serial_number: input.serialNumber.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    quantity_total: Math.max(0, Math.round(Number(input.quantityTotal) || 0)),
    condition: input.condition,
    is_active: input.isActive,
    notes: input.notes.trim(),
  };
}

export async function saveTool(id: string | null, input: ToolInput, actor: string): Promise<void> {
  if (!input.name.trim()) throw new Error("Escribe el nombre de la herramienta.");
  const code = input.code.trim().toUpperCase() || (id ? "" : await nextToolCode());
  const row: Row = toolRow(input);
  if (code) row.code = code;

  if (id) {
    const out = (await outstandingByTool()).get(id) ?? 0;
    if (num(row.quantity_total) < out) {
      throw new Error(
        `Hay ${out} pieza(s) prestadas. La cantidad total no puede ser menor mientras no se devuelvan.`
      );
    }
    const { error } = await db.from("tools").update(row).eq("id", id);
    if (error) throw new Error(friendlyError(error.message));
    return;
  }
  const { error } = await db.from("tools").insert({ ...row, created_by: actor });
  if (error) throw new Error(friendlyError(error.message));
}

export async function deleteTool(id: string): Promise<void> {
  const out = (await outstandingByTool()).get(id) ?? 0;
  if (out > 0) {
    throw new Error("La herramienta está prestada. Registra la devolución antes de eliminarla.");
  }
  const { error } = await db.from("tools").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function friendlyError(message: string) {
  if (message.includes("tools_code_key")) return "Ya existe una herramienta con ese código.";
  return message;
}

// ---------- Solicitudes ----------

async function hydrate(rows: Row[]): Promise<ToolRequest[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [linesRes, eventsRes] = await Promise.all([
    db.from("tool_request_lines").select("*").in("request_id", ids),
    db.from("tool_request_events").select("*").in("request_id", ids),
  ]);
  if (linesRes.error) throw new Error(linesRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);
  const linesBy = new Map<string, ToolRequestLine[]>();
  for (const row of (linesRes.data ?? []) as Row[]) {
    const list = linesBy.get(str(row.request_id)) ?? [];
    list.push(mapLine(row));
    linesBy.set(str(row.request_id), list);
  }
  const eventsBy = new Map<string, ToolRequestEvent[]>();
  for (const row of (eventsRes.data ?? []) as Row[]) {
    const list = eventsBy.get(str(row.request_id)) ?? [];
    list.push(mapEvent(row));
    eventsBy.set(str(row.request_id), list);
  }
  return rows.map((row) =>
    mapRequest(row, linesBy.get(str(row.id)) ?? [], eventsBy.get(str(row.id)) ?? [])
  );
}

export async function getToolRequests(): Promise<ToolRequest[]> {
  const { data, error } = await db
    .from("tool_requests")
    .select("*")
    .order("requested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return hydrate((data ?? []) as Row[]);
}

export async function getToolRequest(id: string): Promise<ToolRequest> {
  const { data, error } = await db.from("tool_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solicitud no encontrada.");
  const [request] = await hydrate([data as Row]);
  return request;
}

async function nextRequestFolio() {
  const prefix = `VH-${new Date().getFullYear()}-`;
  const { data, error } = await db
    .from("tool_requests")
    .select("folio")
    .like("folio", `${prefix}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = str(data?.[0]?.folio);
  const seq = last ? Number(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

async function logEvent(
  requestId: string,
  eventType: string,
  message: string,
  actor: string,
  details: Record<string, unknown> = {}
) {
  await db.from("tool_request_events").insert({
    request_id: requestId,
    event_type: eventType,
    message,
    actor,
    details,
  });
}

export type ServiceOrderOption = { id: string; folio: string; clientName: string; equipmentName: string };

export async function getOpenServiceOrdersForTools(): Promise<ServiceOrderOption[]> {
  const { data, error } = await db
    .from("service_orders")
    .select("id, folio, client_name, equipment_name, status")
    .not("status", "in", "(entregado,cancelado)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    id: str(row.id),
    folio: str(row.folio),
    clientName: str(row.client_name),
    equipmentName: str(row.equipment_name),
  }));
}

export async function createToolRequest(input: CreateToolRequestInput): Promise<ToolRequest> {
  const purpose = input.purpose.trim();
  if (!purpose) throw new Error("Indica para qué se necesitan las herramientas.");
  const wanted = input.lines.filter((line) => line.toolId && line.quantity > 0);
  if (!wanted.length) throw new Error("Agrega al menos una herramienta del catálogo.");
  if (new Set(wanted.map((line) => line.toolId)).size !== wanted.length) {
    throw new Error("Hay herramientas repetidas en la solicitud; junta las cantidades en una sola línea.");
  }

  const catalog = await getTools();
  const byId = new Map(catalog.map((tool) => [tool.id, tool]));
  for (const line of wanted) {
    const tool = byId.get(line.toolId);
    if (!tool) throw new Error("Una de las herramientas ya no está disponible en el catálogo.");
    if (!Number.isInteger(line.quantity)) throw new Error("Las cantidades deben ser piezas enteras.");
    if (line.quantity > tool.quantityTotal) {
      throw new Error(`Solo existen ${tool.quantityTotal} pieza(s) de ${tool.name}.`);
    }
  }

  let order: Row | null = null;
  if (input.serviceOrderId) {
    const { data, error } = await db
      .from("service_orders")
      .select("id, folio, client_name")
      .eq("id", input.serviceOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    order = data as Row | null;
  }

  let created: Row | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const folio = await nextRequestFolio();
    const { data, error } = await db
      .from("tool_requests")
      .insert({
        folio,
        status: "solicitada",
        purpose,
        service_order_id: order ? order.id : null,
        service_order_folio: order ? str(order.folio) : "",
        client_name: order ? str(order.client_name) : "",
        expected_return_at: input.expectedReturnAt || null,
        notes: input.notes.trim(),
        requested_by: input.requester.username,
        requester_name: input.requester.name,
        requester_job_title: input.requester.jobTitle,
        requester_department: input.requester.department,
        requester_employee_number: input.requester.employeeNumber,
        requester_phone: input.requester.phone,
      })
      .select("*")
      .single();
    if (!error) created = data as Row;
    else if (!error.message.includes("tool_requests_folio_key")) throw new Error(error.message);
  }
  if (!created) throw new Error("No se pudo asignar un folio. Intenta de nuevo.");

  const { error: linesError } = await db.from("tool_request_lines").insert(
    wanted.map((line, index) => {
      const tool = byId.get(line.toolId)!;
      return {
        request_id: created!.id,
        tool_id: tool.id,
        tool_code: tool.code,
        tool_name: tool.name,
        tool_brand: tool.brand,
        tool_model: tool.model,
        tool_serial: tool.serialNumber,
        quantity_requested: line.quantity,
        notes: (line.notes ?? "").trim(),
        sort_order: index,
      };
    })
  );
  if (linesError) {
    await db.from("tool_requests").delete().eq("id", created.id);
    throw new Error(linesError.message);
  }

  const pieces = wanted.reduce((acc, line) => acc + line.quantity, 0);
  await logEvent(
    str(created.id),
    "solicitud",
    `Solicitud creada · ${wanted.length} herramienta(s), ${pieces} pieza(s)`,
    input.requester.name
  );
  return getToolRequest(str(created.id));
}

export async function deliverToolRequest(id: string, input: DeliverToolRequestInput): Promise<ToolRequest> {
  const request = await getToolRequest(id);
  if (request.status !== "solicitada") throw new Error("Solo se pueden entregar solicitudes pendientes.");
  const toDeliver = input.lines.filter((line) => line.quantity > 0);
  if (!toDeliver.length) throw new Error("Indica al menos una herramienta a entregar.");

  const catalog = await getTools({ includeInactive: true });
  const byId = new Map(catalog.map((tool) => [tool.id, tool]));
  for (const item of toDeliver) {
    const line = request.lines.find((l) => l.id === item.lineId);
    if (!line) throw new Error("Línea de solicitud no encontrada.");
    if (!Number.isInteger(item.quantity)) throw new Error("Las cantidades deben ser piezas enteras.");
    if (item.quantity > line.quantityRequested) {
      throw new Error(`No puedes entregar más de lo solicitado en ${line.toolName}.`);
    }
    const tool = line.toolId ? byId.get(line.toolId) : null;
    if (!tool) throw new Error(`${line.toolName} ya no existe en el catálogo.`);
    if (item.quantity > tool.quantityAvailable) {
      throw new Error(`Solo hay ${tool.quantityAvailable} pieza(s) disponibles de ${tool.name}.`);
    }
  }

  for (const line of request.lines) {
    const item = input.lines.find((l) => l.lineId === line.id);
    const quantity = item && item.quantity > 0 ? item.quantity : 0;
    const { error } = await db
      .from("tool_request_lines")
      .update({ quantity_delivered: quantity, condition_out: quantity ? item?.conditionOut ?? "" : "" })
      .eq("id", line.id);
    if (error) throw new Error(error.message);
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from("tool_requests")
    .update({
      status: "entregada",
      delivered_by: input.deliverer.username,
      deliverer_name: input.deliverer.name,
      deliverer_job_title: input.deliverer.jobTitle,
      deliverer_department: input.deliverer.department,
      deliverer_employee_number: input.deliverer.employeeNumber,
      delivered_at: now,
      delivery_notes: input.notes.trim(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const pieces = toDeliver.reduce((acc, line) => acc + line.quantity, 0);
  const requested = request.lines.reduce((acc, line) => acc + line.quantityRequested, 0);
  await logEvent(
    id,
    "entrega",
    pieces < requested
      ? `Almacén entregó ${pieces} de ${requested} pieza(s) solicitadas`
      : `Almacén entregó ${pieces} pieza(s)`,
    input.deliverer.name
  );
  return getToolRequest(id);
}

export async function closeToolRequest(
  id: string,
  action: "rechazada" | "cancelada",
  actor: string,
  reason: string
): Promise<ToolRequest> {
  const request = await getToolRequest(id);
  if (request.status !== "solicitada") {
    throw new Error("Solo se pueden rechazar o cancelar solicitudes que aún no se entregan.");
  }
  if (action === "rechazada" && !reason.trim()) throw new Error("Escribe el motivo del rechazo.");
  const { error } = await db
    .from("tool_requests")
    .update({ status: action, closed_by: actor, closed_reason: reason.trim() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(
    id,
    action === "rechazada" ? "rechazo" : "cancelacion",
    `${action === "rechazada" ? "Rechazada" : "Cancelada"}${reason.trim() ? ` · ${reason.trim()}` : ""}`,
    actor
  );
  return getToolRequest(id);
}

/** Registra una devolución (total o parcial) dentro del mismo vale. */
export async function returnToolRequest(id: string, input: ReturnToolRequestInput): Promise<ToolRequest> {
  const request = await getToolRequest(id);
  if (!TOOL_OUT_STATUSES.includes(request.status)) {
    throw new Error("Esta solicitud no tiene herramientas pendientes de devolver.");
  }
  if (!input.receivedBy.trim()) throw new Error("Indica quién recibe la devolución en almacén.");
  const items = input.lines.filter((line) => line.quantity > 0);
  if (!items.length) throw new Error("Indica al menos una pieza devuelta.");

  for (const item of items) {
    const line = request.lines.find((l) => l.id === item.lineId);
    if (!line) throw new Error("Línea de solicitud no encontrada.");
    if (!Number.isInteger(item.quantity)) throw new Error("Las cantidades deben ser piezas enteras.");
    const pending = lineOutstanding(line);
    if (item.quantity > pending) {
      throw new Error(`${line.toolName}: solo quedan ${pending} pieza(s) por devolver.`);
    }
  }

  const byLine = new Map(request.lines.map((line) => [line.id, { ...line }]));
  const lostByTool = new Map<string, number>();
  const damagedTools = new Set<string>();
  for (const item of items) {
    const line = byLine.get(item.lineId)!;
    if (item.condition === "extraviada") {
      line.quantityLost += item.quantity;
      if (line.toolId) lostByTool.set(line.toolId, (lostByTool.get(line.toolId) ?? 0) + item.quantity);
    } else {
      line.quantityReturned += item.quantity;
      if (item.condition === "danado" && line.toolId) damagedTools.add(line.toolId);
    }
    line.conditionIn = item.condition;
  }

  for (const item of items) {
    const line = byLine.get(item.lineId)!;
    const { error } = await db
      .from("tool_request_lines")
      .update({
        quantity_returned: line.quantityReturned,
        quantity_lost: line.quantityLost,
        condition_in: line.conditionIn,
      })
      .eq("id", line.id);
    if (error) throw new Error(error.message);
  }

  if (lostByTool.size || damagedTools.size) {
    const toolIds = [...new Set([...lostByTool.keys(), ...damagedTools])];
    const { data: tools } = await db.from("tools").select("id, quantity_total").in("id", toolIds);
    for (const row of (tools ?? []) as Row[]) {
      const toolId = str(row.id);
      const patch: Row = {};
      const lost = lostByTool.get(toolId) ?? 0;
      if (lost) patch.quantity_total = Math.max(0, num(row.quantity_total) - lost);
      if (damagedTools.has(toolId)) patch.condition = "danado";
      await db.from("tools").update(patch).eq("id", toolId);
    }
  }

  const remaining = [...byLine.values()].reduce((acc, line) => acc + lineOutstanding(line), 0);
  const done = remaining === 0;
  const { error } = await db
    .from("tool_requests")
    .update({
      status: done ? "devuelta" : "devolucion_parcial",
      returned_at: done ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const details: ToolReturnDetails = {
    receivedBy: input.receivedBy.trim(),
    returnedBy: input.returnedBy.trim(),
    notes: input.notes.trim(),
    lines: items.map((item) => {
      const line = byLine.get(item.lineId)!;
      return {
        lineId: line.id,
        toolCode: line.toolCode,
        toolName: line.toolName,
        quantity: item.quantity,
        condition: item.condition,
      };
    }),
  };
  const pieces = items.reduce((acc, item) => acc + item.quantity, 0);
  await logEvent(
    id,
    "devolucion",
    done
      ? `Devolución completa · ${pieces} pieza(s)`
      : `Devolución parcial · ${pieces} pieza(s), quedan ${remaining} por devolver`,
    input.receivedBy.trim(),
    details as unknown as Record<string, unknown>
  );
  return getToolRequest(id);
}
