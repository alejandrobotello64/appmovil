import { mostCommon, normalizeKey } from "@/lib/equipment-grouping";
import { buildVehicleAlerts } from "@/lib/fleet/types";
import { buildHoldDueAlerts, holdDueLabel } from "@/lib/holds/alerts";
import { getStockStatus } from "@/lib/inventory/storage";
import { surveyAverage } from "@/lib/quality/types";
import type { QuoteStatus } from "@/lib/quotes/types";
import {
  SERVICE_ORDER_STATUSES,
  SERVICE_TYPES,
  type ServiceOrderStatus,
} from "@/lib/service-orders/types";
import type { TenderStatus } from "@/lib/tenders/types";
import type { HomeArea, HomeData, ServiceOrderLite } from "./home-data";

// ---------- Periodos ----------

export const PERIODS = [
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "ytd", label: "Año en curso" },
  { id: "12m", label: "12 meses" },
] as const;

export type PeriodId = (typeof PERIODS)[number]["id"];

type Range = { start: number; end: number };

export type PeriodRange = { current: Range; previous: Range; compareLabel: string };

const DAY = 86_400_000;

export function periodRange(id: PeriodId, now: number): PeriodRange {
  const end = now;
  if (id === "ytd") {
    const today = new Date(now);
    const start = new Date(today.getFullYear(), 0, 1).getTime();
    const prevStart = new Date(today.getFullYear() - 1, 0, 1).getTime();
    const prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate(), 23, 59, 59).getTime();
    return {
      current: { start, end },
      previous: { start: prevStart, end: prevEnd },
      compareLabel: "vs mismo periodo del año pasado",
    };
  }
  const days = id === "30d" ? 30 : id === "90d" ? 90 : 365;
  const start = end - days * DAY;
  return {
    current: { start, end },
    previous: { start: start - days * DAY, end: start },
    compareLabel: `vs ${days === 365 ? "12 meses" : `${days} días`} anteriores`,
  };
}

// ---------- Utilidades ----------

/** Acepta "YYYY-MM-DD" (fecha local) o ISO con hora. */
export function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function inRange(value: string | null | undefined, range: Range) {
  const time = toTime(value);
  return time !== null && time >= range.start && time <= range.end;
}

function daysFrom(value: string, now: number): number | null {
  const time = toTime(value);
  if (time === null) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(time);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / DAY);
}

function isMxn(currency: string | null | undefined) {
  return !currency || currency.trim().toUpperCase() === "MXN";
}

function sum<T>(rows: T[], pick: (row: T) => number) {
  return rows.reduce((total, row) => total + (pick(row) || 0), 0);
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

// ---------- Biomédica ----------

export const OPEN_SERVICE_STATUSES: ServiceOrderStatus[] = [
  "recibido",
  "diagnostico",
  "en_proceso",
  "espera_refacciones",
  "terminado",
];

function isOpenOrder(order: ServiceOrderLite) {
  return OPEN_SERVICE_STATUSES.includes(order.status);
}

function receivedAt(order: ServiceOrderLite) {
  return order.receptionAt || order.createdAt;
}

function isDelivered(order: ServiceOrderLite, range: Range) {
  return order.status === "entregado" && inRange(order.deliveredAt, range);
}

function cycleDays(order: ServiceOrderLite): number | null {
  const start = toTime(order.receptionAt);
  const end = toTime(order.deliveredAt);
  if (start === null || end === null || end < start) return null;
  return (end - start) / DAY;
}

function serviceWindow(orders: ServiceOrderLite[], range: Range) {
  const received = orders.filter(
    (order) => order.status !== "cancelado" && inRange(receivedAt(order), range)
  );
  const delivered = orders.filter((order) => isDelivered(order, range));
  const withPromise = delivered.filter((order) => toTime(order.promisedAt) !== null);
  const onTime = withPromise.filter((order) => {
    const promised = new Date(toTime(order.promisedAt)!);
    promised.setHours(23, 59, 59, 999);
    return (toTime(order.deliveredAt) ?? Infinity) <= promised.getTime();
  });
  return {
    received: received.length,
    urgent: received.filter((order) => order.priority === "urgente").length,
    warranty: received.filter((order) => order.underWarranty).length,
    delivered: delivered.length,
    revenue: sum(delivered.filter((order) => isMxn(order.currency)), (order) => order.total),
    avgCycle: average(delivered.map(cycleDays).filter((value): value is number => value !== null)),
    onTimeRate: withPromise.length ? onTime.length / withPromise.length : null,
  };
}

// ---------- Ventas y licitaciones ----------

const QUOTE_OPEN: QuoteStatus[] = ["enviada", "en_seguimiento", "negociacion"];
const QUOTE_CLOSED_LOST: QuoteStatus[] = ["rechazada", "vencida"];
export const QUOTE_FUNNEL: QuoteStatus[] = ["borrador", "enviada", "en_seguimiento", "negociacion", "aceptada"];

const TENDER_ACTIVE: TenderStatus[] = ["prospecto", "analisis", "en_preparacion", "presentada", "en_evaluacion"];

function salesWindow(data: HomeData, range: Range) {
  const quotes = data.quotes.filter(
    (quote) => quote.status !== "cancelada" && inRange(quote.quoteDate || quote.createdAt, range)
  );
  const mxn = quotes.filter((quote) => isMxn(quote.currency));
  const won = mxn.filter((quote) => quote.status === "aceptada");
  const decided = quotes.filter(
    (quote) => quote.status === "aceptada" || QUOTE_CLOSED_LOST.includes(quote.status)
  );
  return {
    count: quotes.length,
    quoted: sum(mxn, (quote) => quote.total),
    wonCount: quotes.filter((quote) => quote.status === "aceptada").length,
    won: sum(won, (quote) => quote.total),
    closeRate: decided.length
      ? decided.filter((quote) => quote.status === "aceptada").length / decided.length
      : null,
  };
}

// ---------- Resultado ----------

export type Kpi = {
  current: number | null;
  previous: number | null;
};

export type MonthPoint = {
  key: string;
  label: string;
  osReceived: number;
  osDelivered: number;
  serviceRevenue: number;
  quotesCreated: number;
  quotesWon: number;
  quotedAmount: number;
};

export type ClientActivity = {
  key: string;
  clientId: string | null;
  name: string;
  orders: number;
  openOrders: number;
  serviceRevenue: number;
  quotes: number;
  quoted: number;
  won: number;
  equipment: number;
  csat: number | null;
  lastActivity: number | null;
};

export type EquipmentActivity = {
  key: string;
  name: string;
  orders: number;
  corrective: number;
  clients: number;
  lastAt: number | null;
};

export type TechnicianLoad = {
  name: string;
  open: number;
  overdue: number;
  delivered: number;
  avgCycle: number | null;
};

export type AlertSeverity = "critical" | "warning";

export type HomeAlert = {
  id: string;
  area: HomeArea;
  severity: AlertSeverity;
  title: string;
  detail: string;
  due: string;
  sortKey: number;
  href: string;
};

export type BarDatum = { id: string; label: string; value: number; amount?: number };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function monthKey(time: number) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dueText(days: number) {
  if (days < 0) {
    const n = Math.abs(days);
    return `Venció hace ${n} ${n === 1 ? "día" : "días"}`;
  }
  if (days === 0) return "Vence hoy";
  return `Vence en ${days} ${days === 1 ? "día" : "días"}`;
}

export function computeHomeMetrics(data: HomeData, periodId: PeriodId) {
  const now = data.loadedAt;
  const period = periodRange(periodId, now);
  const has = (area: HomeArea) => data.loaded.includes(area);

  // --- Biomédica ---
  const serviceCur = serviceWindow(data.serviceOrders, period.current);
  const servicePrev = serviceWindow(data.serviceOrders, period.previous);
  const openOrders = data.serviceOrders.filter(isOpenOrder);
  const overdueOrders = openOrders.filter((order) => {
    const days = daysFrom(order.promisedAt, now);
    return days !== null && days < 0;
  });
  const pendingAuthorization = data.serviceOrders.filter((order) => order.status === "cotizacion").length;

  const openByStatus: BarDatum[] = SERVICE_ORDER_STATUSES.filter((status) =>
    OPEN_SERVICE_STATUSES.includes(status.id) || status.id === "cotizacion"
  ).map((status) => ({
    id: status.id,
    label: status.label,
    value: data.serviceOrders.filter((order) => order.status === status.id).length,
  }));

  const receivedInPeriod = data.serviceOrders.filter(
    (order) => order.status !== "cancelado" && inRange(receivedAt(order), period.current)
  );
  const serviceTypes: BarDatum[] = SERVICE_TYPES.map((type) => ({
    id: type.id,
    label: type.label,
    value: receivedInPeriod.filter((order) => order.serviceType === type.id).length,
  }));

  // --- Ventas ---
  const salesCur = salesWindow(data, period.current);
  const salesPrev = salesWindow(data, period.previous);
  const pipelineQuotes = data.quotes.filter(
    (quote) => QUOTE_OPEN.includes(quote.status) && isMxn(quote.currency)
  );
  const pipeline = sum(pipelineQuotes, (quote) => quote.total);
  const weightedPipeline = sum(pipelineQuotes, (quote) => (quote.total * (quote.probability || 0)) / 100);
  const funnel: BarDatum[] = QUOTE_FUNNEL.map((status) => {
    const rows = data.quotes.filter((quote) => quote.status === status);
    return {
      id: status,
      label: status,
      value: rows.length,
      amount: sum(rows.filter((quote) => isMxn(quote.currency)), (quote) => quote.total),
    };
  });

  // --- Licitaciones ---
  const activeTenders = data.tenders.filter((tender) => TENDER_ACTIVE.includes(tender.status));
  const tenderOffered = sum(
    activeTenders.filter((tender) => isMxn(tender.moneda)),
    (tender) => tender.montoOfertado || tender.montoEstimado
  );
  const tendersWon = (range: Range) =>
    data.tenders.filter(
      (tender) => tender.status === "ganada" && inRange(tender.falloAt || tender.updatedAt, range)
    ).length;

  // --- Almacén ---
  const activeItems = data.inventory.filter((item) => item.isActive);
  const inventoryValue = sum(activeItems, (item) => item.quantity * item.unitPrice);
  const stockAlerts = activeItems.filter(
    (item) => item.itemKind !== "equipo" && getStockStatus(item.quantity, item.minStock) !== "disponible"
  );
  const expiring = activeItems.filter((item) => {
    const days = daysFrom(item.expiryDate, now);
    return item.quantity > 0 && days !== null && days <= 90;
  });

  // --- Calidad ---
  const surveyScores = (range: Range) =>
    data.surveys
      .filter((survey) => survey.status === "respondida" && inRange(survey.respondedAt || survey.createdAt, range))
      .map((survey) => ({ survey, score: surveyAverage(survey) }));
  const surveysCur = surveyScores(period.current);
  const surveysPrev = surveyScores(period.previous);
  const csat = (rows: typeof surveysCur) =>
    average(rows.map((row) => row.score).filter((value): value is number => value !== null));
  const recommendAnswers = surveysCur.filter((row) => row.survey.wouldRecommend !== null);
  const recommendRate = recommendAnswers.length
    ? recommendAnswers.filter((row) => row.survey.wouldRecommend).length / recommendAnswers.length
    : null;

  // --- Clientes ---
  const activeEquipment = data.clientEquipment.filter((equipment) => equipment.status !== "baja");
  const operativeRate = activeEquipment.length
    ? activeEquipment.filter((equipment) => equipment.status === "operativo").length / activeEquipment.length
    : null;
  const equipmentStatus: BarDatum[] = [
    { id: "operativo", label: "Operativo", value: 0 },
    { id: "en_reparacion", label: "En reparación", value: 0 },
    { id: "fuera_servicio", label: "Fuera de servicio", value: 0 },
  ].map((row) => ({
    ...row,
    value: activeEquipment.filter((equipment) => equipment.status === row.id).length,
  }));

  // --- Serie mensual (12 meses) ---
  const today = new Date(now);
  const months: MonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
    return {
      key: monthKey(date.getTime()),
      label: `${MONTHS[date.getMonth()]}${date.getMonth() === 0 ? ` ${String(date.getFullYear()).slice(2)}` : ""}`,
      osReceived: 0,
      osDelivered: 0,
      serviceRevenue: 0,
      quotesCreated: 0,
      quotesWon: 0,
      quotedAmount: 0,
    };
  });
  const byMonth = new Map(months.map((month) => [month.key, month]));
  for (const order of data.serviceOrders) {
    if (order.status === "cancelado") continue;
    const received = toTime(receivedAt(order));
    if (received !== null) {
      const month = byMonth.get(monthKey(received));
      if (month) month.osReceived += 1;
    }
    const delivered = order.status === "entregado" ? toTime(order.deliveredAt) : null;
    if (delivered !== null) {
      const month = byMonth.get(monthKey(delivered));
      if (month) {
        month.osDelivered += 1;
        if (isMxn(order.currency)) month.serviceRevenue += order.total;
      }
    }
  }
  for (const quote of data.quotes) {
    if (quote.status === "cancelada") continue;
    const time = toTime(quote.quoteDate || quote.createdAt);
    const month = time !== null ? byMonth.get(monthKey(time)) : undefined;
    if (!month) continue;
    month.quotesCreated += 1;
    if (isMxn(quote.currency)) month.quotedAmount += quote.total;
    if (quote.status === "aceptada") month.quotesWon += 1;
  }

  // --- Clientes con más actividad (acumulado de todas las áreas) ---
  const clientNames = new Map(data.clients.map((client) => [client.id, client.name]));
  const nameKeyToId = new Map(data.clients.map((client) => [normalizeKey(client.name), client.id]));
  const clientKey = (clientId: string | null, name: string) => {
    if (clientId) return clientId;
    const normalized = normalizeKey(name);
    if (!normalized) return "";
    return nameKeyToId.get(normalized) ?? `nombre:${normalized}`;
  };
  const activity = new Map<string, ClientActivity & { names: string[] }>();
  const touch = (clientId: string | null, name: string, time: number | null) => {
    const key = clientKey(clientId, name);
    if (!key) return null;
    let row = activity.get(key);
    if (!row) {
      const id = clientNames.has(key) ? key : null;
      row = {
        key,
        clientId: id,
        name: "",
        names: [],
        orders: 0,
        openOrders: 0,
        serviceRevenue: 0,
        quotes: 0,
        quoted: 0,
        won: 0,
        equipment: 0,
        csat: null,
        lastActivity: null,
      };
      activity.set(key, row);
    }
    if (name) row.names.push(name);
    if (time !== null && (row.lastActivity === null || time > row.lastActivity)) row.lastActivity = time;
    return row;
  };
  for (const order of data.serviceOrders) {
    if (order.status === "cancelado") continue;
    const open = isOpenOrder(order);
    const inPeriod = inRange(receivedAt(order), period.current);
    const delivered = isDelivered(order, period.current);
    if (!inPeriod && !open && !delivered) continue;
    const row = touch(order.clientId, order.clientName, toTime(receivedAt(order)));
    if (!row) continue;
    if (inPeriod) row.orders += 1;
    if (open) row.openOrders += 1;
    if (delivered && isMxn(order.currency)) row.serviceRevenue += order.total;
  }
  for (const quote of data.quotes) {
    if (quote.status === "cancelada" || !inRange(quote.quoteDate || quote.createdAt, period.current)) continue;
    const row = touch(quote.clientId, quote.clientName, toTime(quote.quoteDate || quote.createdAt));
    if (!row) continue;
    row.quotes += 1;
    if (isMxn(quote.currency)) {
      row.quoted += quote.total;
      if (quote.status === "aceptada") row.won += quote.total;
    }
  }
  const csatByClient = new Map<string, number[]>();
  for (const { survey, score } of surveysCur) {
    if (score === null) continue;
    const key = clientKey(survey.clientId, survey.clientName);
    if (key) csatByClient.set(key, [...(csatByClient.get(key) ?? []), score]);
  }
  const equipmentByClient = new Map<string, number>();
  for (const equipment of activeEquipment) {
    equipmentByClient.set(equipment.clientId, (equipmentByClient.get(equipment.clientId) ?? 0) + 1);
  }
  const clientActivity: ClientActivity[] = Array.from(activity.values())
    .map(({ names, ...row }) => ({
      ...row,
      name: (row.clientId && clientNames.get(row.clientId)) || mostCommon(names) || "Sin nombre",
      equipment: equipmentByClient.get(row.key) ?? 0,
      csat: average(csatByClient.get(row.key) ?? []),
    }))
    .sort(
      (a, b) =>
        b.orders + b.quotes + b.openOrders - (a.orders + a.quotes + a.openOrders) ||
        b.serviceRevenue + b.quoted - (a.serviceRevenue + a.quoted) ||
        a.name.localeCompare(b.name, "es")
    );

  // --- Equipos con más servicios ---
  const equipmentMap = new Map<string, { names: string[]; orders: ServiceOrderLite[] }>();
  for (const order of receivedInPeriod) {
    const brandModel = [order.equipmentBrand, order.equipmentModel].filter(Boolean).join(" ");
    const label = brandModel || order.equipmentName;
    const key = normalizeKey(label);
    if (!key) continue;
    const entry = equipmentMap.get(key) ?? { names: [], orders: [] };
    entry.names.push(label);
    entry.orders.push(order);
    equipmentMap.set(key, entry);
  }
  const topEquipment: EquipmentActivity[] = Array.from(equipmentMap.entries())
    .map(([key, entry]) => ({
      key,
      name: mostCommon(entry.names),
      orders: entry.orders.length,
      corrective: entry.orders.filter((order) => order.serviceType === "correctivo").length,
      clients: new Set(entry.orders.map((order) => clientKey(order.clientId, order.clientName)).filter(Boolean)).size,
      lastAt: Math.max(...entry.orders.map((order) => toTime(receivedAt(order)) ?? 0)) || null,
    }))
    .sort((a, b) => b.orders - a.orders || b.corrective - a.corrective)
    .slice(0, 8);

  // --- Carga por técnico ---
  const techMap = new Map<string, { names: string[]; open: number; overdue: number; delivered: ServiceOrderLite[] }>();
  const techEntry = (name: string) => {
    const key = normalizeKey(name) || "sin-asignar";
    const entry = techMap.get(key) ?? { names: [], open: 0, overdue: 0, delivered: [] };
    entry.names.push(name.trim() || "Sin asignar");
    techMap.set(key, entry);
    return entry;
  };
  for (const order of openOrders) {
    const entry = techEntry(order.technician);
    entry.open += 1;
    if (overdueOrders.includes(order)) entry.overdue += 1;
  }
  for (const order of data.serviceOrders) {
    if (isDelivered(order, period.current)) techEntry(order.technician).delivered.push(order);
  }
  const technicians: TechnicianLoad[] = Array.from(techMap.values())
    .map((entry) => ({
      name: mostCommon(entry.names),
      open: entry.open,
      overdue: entry.overdue,
      delivered: entry.delivered.length,
      avgCycle: average(entry.delivered.map(cycleDays).filter((value): value is number => value !== null)),
    }))
    .sort((a, b) => b.open - a.open || b.delivered - a.delivered);

  // --- Alertas y vencimientos ---
  const alerts: HomeAlert[] = [];
  const push = (alert: Omit<HomeAlert, "sortKey"> & { days: number }) => {
    const { days, ...rest } = alert;
    alerts.push({ ...rest, sortKey: (rest.severity === "critical" ? 0 : 1_000_000) + days });
  };

  for (const order of overdueOrders) {
    const days = daysFrom(order.promisedAt, now) ?? 0;
    push({
      id: `os-${order.id}`,
      area: "servicio",
      severity: "critical",
      title: `OS ${order.folio} atrasada`,
      detail: [order.clientName, order.equipmentName].filter(Boolean).join(" · "),
      due: `Prometida hace ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}`,
      href: "/dashboard/ordenes-servicio?tab=ordenes",
      days,
    });
  }
  for (const item of stockAlerts) {
    const out = getStockStatus(item.quantity, item.minStock) === "agotado";
    push({
      id: `stock-${item.id}`,
      area: "inventario",
      severity: out ? "critical" : "warning",
      title: out ? `${item.name} agotado` : `${item.name} con stock bajo`,
      detail: `${item.quantity} ${item.unit} · mínimo ${item.minStock}`,
      due: out ? "Sin existencias" : "Reabastecer",
      href: `/dashboard/almacen?tab=${item.category === "equipos" ? "equipo" : item.category}`,
      days: out ? -1 : 0,
    });
  }
  for (const item of expiring) {
    const days = daysFrom(item.expiryDate, now) ?? 0;
    if (days > 30) continue;
    push({
      id: `cad-${item.id}`,
      area: "inventario",
      severity: days < 0 ? "critical" : "warning",
      title: days < 0 ? `${item.name} caducado` : `${item.name} por caducar`,
      detail: `${item.quantity} ${item.unit}${item.sku ? ` · ${item.sku}` : ""}`,
      due: dueText(days),
      href: `/dashboard/almacen?tab=${item.category === "equipos" ? "equipo" : item.category}`,
      days,
    });
  }
  for (const doc of data.sanitaryDocs) {
    const days = daysFrom(doc.validUntil, now);
    if (days === null || days > 90) continue;
    push({
      id: `reg-${doc.id}`,
      area: "registros",
      severity: days < 0 ? "critical" : "warning",
      title: doc.title,
      detail: [doc.brand, doc.model, doc.version].filter(Boolean).join(" · "),
      due: dueText(days),
      href: "/dashboard/almacen?tab=registros_sanitarios",
      days,
    });
  }
  for (const instrument of data.instruments) {
    const days = daysFrom(instrument.certificateExpiresAt, now);
    if (days === null || days > 30) continue;
    push({
      id: `ins-${instrument.id}`,
      area: "instrumentos",
      severity: days < 0 ? "critical" : "warning",
      title: `Certificado de ${instrument.name}`,
      detail: [instrument.brand, instrument.model, instrument.serialNumber].filter(Boolean).join(" · "),
      due: dueText(days),
      href: "/dashboard/ordenes-servicio?tab=instrumentos",
      days,
    });
  }
  for (const quote of data.quotes) {
    if (!QUOTE_OPEN.includes(quote.status)) continue;
    const follow = daysFrom(quote.nextFollowUp, now);
    const valid = daysFrom(quote.validUntil, now);
    if (follow !== null && follow < 0) {
      push({
        id: `cot-seg-${quote.id}`,
        area: "ventas",
        severity: "warning",
        title: `Seguimiento pendiente ${quote.folio}`,
        detail: quote.clientName,
        due: `Atrasado ${Math.abs(follow)} ${Math.abs(follow) === 1 ? "día" : "días"}`,
        href: "/dashboard/ventas?tab=cotizaciones",
        days: follow,
      });
    } else if (valid !== null && valid <= 7) {
      push({
        id: `cot-vig-${quote.id}`,
        area: "ventas",
        severity: valid < 0 ? "critical" : "warning",
        title: `Cotización ${quote.folio} por vencer`,
        detail: quote.clientName,
        due: dueText(valid),
        href: "/dashboard/ventas?tab=cotizaciones",
        days: valid,
      });
    }
  }
  for (const tender of activeTenders) {
    const days = daysFrom(tender.limitePropuestas, now);
    if (days === null || days < 0 || days > 10) continue;
    push({
      id: `lic-${tender.id}`,
      area: "licitaciones",
      severity: days <= 3 ? "critical" : "warning",
      title: `Propuesta ${tender.folioInterno || tender.folioComprasmx}`,
      detail: tender.convocante,
      due: days === 0 ? "Se entrega hoy" : `Entrega en ${days} ${days === 1 ? "día" : "días"}`,
      href: "/dashboard/licitaciones",
      days,
    });
  }
  for (const vehicle of data.vehicles) {
    if (!vehicle.isActive || vehicle.status === "baja") continue;
    for (const alert of buildVehicleAlerts(vehicle)) {
      if (alert.severity === "ok") continue;
      push({
        id: `veh-${vehicle.id}-${alert.kind}`,
        area: "flotilla",
        severity: alert.severity === "overdue" ? "critical" : "warning",
        title: alert.label,
        detail: alert.detail,
        due: alert.severity === "overdue" ? "Vencido" : "Próximo",
        href: "/dashboard/flotilla",
        days: alert.severity === "overdue" ? -1 : 15,
      });
    }
  }
  for (const hold of buildHoldDueAlerts(data.holds).alerts) {
    if (hold.bucket !== "vencido" && hold.daysUntil > 10) continue;
    push({
      id: `apt-${hold.id}`,
      area: "apartados",
      severity: hold.bucket === "vencido" ? "critical" : "warning",
      title: `Apartado ${hold.folio}`,
      detail: [hold.projectName, hold.clientName].filter(Boolean).join(" · "),
      due: holdDueLabel(hold.daysUntil, hold.bucket) ?? "",
      href: "/dashboard/almacen?tab=apartados",
      days: hold.daysUntil,
    });
  }
  alerts.sort((a, b) => a.sortKey - b.sortKey);

  return {
    period,
    has,
    service: {
      revenue: { current: serviceCur.revenue, previous: servicePrev.revenue },
      received: { current: serviceCur.received, previous: servicePrev.received },
      delivered: { current: serviceCur.delivered, previous: servicePrev.delivered },
      avgCycle: { current: serviceCur.avgCycle, previous: servicePrev.avgCycle },
      onTimeRate: serviceCur.onTimeRate,
      urgent: serviceCur.urgent,
      warranty: serviceCur.warranty,
      open: openOrders.length,
      overdue: overdueOrders.length,
      pendingAuthorization,
      openByStatus,
      serviceTypes,
    },
    sales: {
      quoted: { current: salesCur.quoted, previous: salesPrev.quoted },
      count: { current: salesCur.count, previous: salesPrev.count },
      won: { current: salesCur.won, previous: salesPrev.won },
      wonCount: salesCur.wonCount,
      closeRate: { current: salesCur.closeRate, previous: salesPrev.closeRate },
      pipeline,
      weightedPipeline,
      funnel,
    },
    tenders: {
      active: activeTenders.length,
      offered: tenderOffered,
      won: { current: tendersWon(period.current), previous: tendersWon(period.previous) },
    },
    inventory: {
      value: inventoryValue,
      items: activeItems.length,
      stockAlerts: stockAlerts.length,
      outOfStock: stockAlerts.filter((item) => getStockStatus(item.quantity, item.minStock) === "agotado").length,
      expiring: expiring.length,
    },
    quality: {
      csat: { current: csat(surveysCur), previous: csat(surveysPrev) },
      responses: surveysCur.length,
      recommendRate,
    },
    clients: {
      active: data.clients.filter((client) => client.isActive).length,
      equipment: activeEquipment.length,
      operativeRate,
      equipmentStatus,
    },
    months,
    clientActivity,
    topEquipment,
    technicians,
    alerts,
  };
}

export type HomeMetrics = ReturnType<typeof computeHomeMetrics>;
