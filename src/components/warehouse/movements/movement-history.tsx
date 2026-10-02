"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesktopTable, ResponsiveDataList } from "@/components/ui/responsive-data-list";
import { SearchInput } from "@/components/ui/search-input";
import { SortableTable } from "@/components/ui/sortable-table";
import { getSession } from "@/lib/auth";
import { matchesSearch } from "@/lib/search";
import {
  MOVEMENT_KIND_LABELS,
  getMovementHistory,
  placeLabel,
  relatedMovements,
  type MovementKind,
  type MovementRecord,
} from "@/lib/warehouse/movements";
import type { PdfOutput } from "@/lib/warehouse/movements-pdf";
import type { Warehouse } from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";
import { MovementVoucherActions } from "./movement-pdf-actions";
import { Alert, KindBadge, inputClass } from "./movement-ui";

const PERIODS = [
  { id: "7", label: "Últimos 7 días" },
  { id: "30", label: "Últimos 30 días" },
  { id: "90", label: "Últimos 90 días" },
  { id: "365", label: "Último año" },
  { id: "all", label: "Todo" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

const KIND_GROUPS: { id: string; label: string; kinds: MovementKind[] | null }[] = [
  { id: "todos", label: "Todos", kinds: null },
  { id: "entradas", label: "Entradas", kinds: ["entrada"] },
  { id: "salidas", label: "Salidas", kinds: ["salida"] },
  { id: "traslados", label: "Traspasos y ubicación", kinds: ["traspaso", "cambio_ubicacion"] },
  { id: "canjes", label: "Canjes", kinds: ["canje_caducado"] },
  { id: "otros", label: "Ajustes y devoluciones", kinds: ["ajuste", "devolucion"] },
];

const MOVE_KINDS: MovementKind[] = ["traspaso", "cambio_ubicacion"];

function periodStart(period: PeriodId) {
  if (period === "all") return undefined;
  const date = new Date();
  date.setDate(date.getDate() - Number(period));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(rows: MovementRecord[]) {
  const header = [
    "Fecha",
    "Folio",
    "Tipo",
    "SKU",
    "Producto",
    "Cantidad",
    "Origen",
    "Destino",
    "Lote",
    "Caducidad",
    "Series",
    "Motivo",
    "Nota",
    "Usuario",
  ];
  const lines = rows.map((row) =>
    [
      formatDateTime(row.occurredAt),
      row.folio,
      MOVEMENT_KIND_LABELS[row.kind] ?? row.kind,
      row.productSku,
      row.productName,
      row.quantity,
      placeLabel(row.from),
      placeLabel(row.to),
      row.lotNumber,
      row.lotExpiry,
      row.serials,
      row.reason,
      row.note,
      row.createdBy,
    ]
      .map(csvCell)
      .join(",")
  );
  const blob = new Blob([`\uFEFF${[header.join(","), ...lines].join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Route({ movement }: { movement: MovementRecord }) {
  const from = placeLabel(movement.from);
  const to = placeLabel(movement.to);
  if (!from && !to) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={from ? "" : "text-muted-foreground"}>{from || "Externo"}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" />
      <span className={to ? "font-medium" : "text-muted-foreground"}>{to || "Externo"}</span>
    </span>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold text-foreground", tone)}>{value}</p>
    </div>
  );
}

type Props = {
  warehouses: Warehouse[];
  refreshKey: number;
};

export function MovementHistory({ warehouses, refreshKey }: Props) {
  const [period, setPeriod] = useState<PeriodId>("30");
  const [group, setGroup] = useState("todos");
  const [warehouseId, setWarehouseId] = useState("");
  const [query, setQuery] = useState("");
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");

  const requestKey = `${period}:${refreshKey}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    getMovementHistory({ from: periodStart(period), limit: 1000 })
      .then((rows) => {
        if (cancelled) return;
        setMovements(rows);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(`${period}:${refreshKey}`);
      });
    return () => {
      cancelled = true;
    };
  }, [period, refreshKey]);

  const baseFiltered = useMemo(
    () =>
      movements.filter(
        (movement) =>
          (!warehouseId ||
            movement.from?.warehouseId === warehouseId ||
            movement.to?.warehouseId === warehouseId) &&
          matchesSearch(query, [
            movement.folio,
            movement.productSku,
            movement.productName,
            MOVEMENT_KIND_LABELS[movement.kind],
            placeLabel(movement.from),
            placeLabel(movement.to),
            movement.lotNumber,
            movement.serials,
            movement.reason,
            movement.note,
            movement.createdBy,
          ])
      ),
    [movements, warehouseId, query]
  );

  const visible = useMemo(() => {
    const kinds = KIND_GROUPS.find((item) => item.id === group)?.kinds;
    return kinds ? baseFiltered.filter((movement) => kinds.includes(movement.kind)) : baseFiltered;
  }, [baseFiltered, group]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of KIND_GROUPS) {
      counts[item.id] = item.kinds
        ? baseFiltered.filter((movement) => item.kinds!.includes(movement.kind)).length
        : baseFiltered.length;
    }
    return counts;
  }, [baseFiltered]);

  const kpis = useMemo(() => {
    let unitsIn = 0;
    let unitsOut = 0;
    let moved = 0;
    for (const movement of visible) {
      if (MOVE_KINDS.includes(movement.kind)) {
        moved += movement.quantity;
      } else {
        unitsIn += movement.qtyIn;
        unitsOut += movement.qtyOut;
      }
    }
    return { count: visible.length, unitsIn, unitsOut, moved };
  }, [visible]);

  const [reportBusy, setReportBusy] = useState<PdfOutput | null>(null);

  async function exportReport(output: PdfOutput) {
    setReportBusy(output);
    setError("");
    try {
      const { downloadMovementsReportPdf } = await import("@/lib/warehouse/movements-pdf");
      const warehouse = warehouses.find((item) => item.id === warehouseId);
      await downloadMovementsReportPdf(visible, {
        filters: {
          period: PERIODS.find((item) => item.id === period)?.label ?? "",
          kind: KIND_GROUPS.find((item) => item.id === group)?.label ?? "Todos",
          warehouse: warehouse ? `${warehouse.code} — ${warehouse.name}` : "Todos los almacenes",
          search: query.trim(),
        },
        generatedBy: getSession()?.username ?? "",
        output,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el reporte.");
    } finally {
      setReportBusy(null);
    }
  }

  const emptyMessage = loading
    ? "Cargando movimientos..."
    : query.trim() || warehouseId || group !== "todos"
      ? "Ningún movimiento coincide con los filtros."
      : "No hay movimientos en este periodo.";

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-4 border-b border-border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-foreground">
              Historial de movimientos
              {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
            </h3>
            <p className="text-sm text-muted-foreground">
              Kardex de todos los almacenes: entradas, salidas, traspasos, cambios de ubicación y canjes.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={visible.length === 0 || reportBusy !== null}
              onClick={() => exportReport("print")}
            >
              {reportBusy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              Imprimir
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={visible.length === 0 || reportBusy !== null}
              onClick={() => exportReport("download")}
            >
              {reportBusy === "download" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
              PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={visible.length === 0}
              onClick={() => downloadCsv(visible)}
            >
              <Download className="size-4" /> CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Movimientos" value={kpis.count} />
          <Kpi label="Unidades que entraron" value={kpis.unitsIn} tone="text-emerald-600 dark:text-emerald-300" />
          <Kpi label="Unidades que salieron" value={kpis.unitsOut} tone="text-amber-600 dark:text-amber-300" />
          <Kpi label="Unidades trasladadas" value={kpis.moved} tone="text-indigo-600 dark:text-indigo-300" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {KIND_GROUPS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setGroup(item.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                group === item.id
                  ? "border-transparent bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px]",
                  group === item.id ? "bg-white/20" : "bg-muted"
                )}
              >
                {groupCounts[item.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-[180px_220px_1fr]">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodId)}
            aria-label="Periodo"
            className={inputClass}
          >
            {PERIODS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            aria-label="Almacén"
            className={inputClass}
          >
            <option value="">Todos los almacenes</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.name}
              </option>
            ))}
          </select>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar folio, producto, lote, serie, usuario..."
          />
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
      </div>

      <ResponsiveDataList
        emptyMessage={emptyMessage}
        items={visible.map((movement) => ({
          key: movement.id,
          title: movement.productName,
          subtitle: `${movement.productSku} · ${movement.folio || "sin folio"}`,
          badge: <KindBadge kind={movement.kind} />,
          fields: [
            { label: "Fecha", value: formatDateTime(movement.occurredAt) },
            { label: "Cantidad", value: movement.quantity },
            { label: "Ruta", value: <Route movement={movement} /> },
            { label: "Lote", value: movement.lotNumber || "—" },
            { label: "Usuario", value: movement.createdBy || "—" },
            { label: "Nota", value: movement.note || movement.reason || "—" },
          ],
          actions: (
            <MovementVoucherActions
              records={async () => relatedMovements(movement, movements)}
              warehouses={warehouses}
              variant="button"
              onError={setError}
            />
          ),
        }))}
      />

      <DesktopTable>
        <SortableTable className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Origen → Destino</th>
              <th className="px-4 py-3 font-medium">Lote</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Nota</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr data-sort="off">
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visible.map((movement) => (
                <tr key={movement.id} className="border-t border-border/70 align-top hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground" data-sort={movement.occurredAt}>
                    {formatDateTime(movement.occurredAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{movement.folio || "—"}</td>
                  <td className="px-4 py-3">
                    <KindBadge kind={movement.kind} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{movement.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{movement.productSku}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium" data-sort={movement.quantity}>
                    {movement.kind === "salida" ? "−" : movement.kind === "entrada" ? "+" : ""}
                    {movement.quantity}
                  </td>
                  <td className="px-4 py-3">
                    <Route movement={movement} />
                    {movement.serials ? (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">S/N {movement.serials}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{movement.lotNumber || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{movement.createdBy || "—"}</td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground">
                    {movement.note || movement.reason || "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <MovementVoucherActions
                      records={async () => relatedMovements(movement, movements)}
                      warehouses={warehouses}
                      onError={setError}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </SortableTable>
      </DesktopTable>
    </section>
  );
}
