"use client";
import { Th } from "@/components/ui/th";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Package, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { inventoryModuleForCategory } from "@/lib/auth/permissions";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import { getStockStatus } from "@/lib/inventory/storage";
import {
  getInventoryStock,
  placementsFor,
  SERIAL_STATUS_LABELS,
  trackingFor,
  type InventoryStock,
} from "@/lib/inventory/tracking";
import {
  INVENTORY_CATEGORIES,
  isSupplyCategory,
  type InventoryItem,
} from "@/lib/inventory/types";
import { LABEL_FORMATS, printProductLabels, type LabelFormat } from "@/lib/scan/label";
import { SCAN_MATCH_LABELS, type ScanMatch } from "@/lib/scan/lookup";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  disponible: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  bajo_stock: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  agotado: "bg-red-500/15 text-red-700 dark:text-red-300",
} as const;

const STATUS_TEXT = {
  disponible: "Disponible",
  bajo_stock: "Bajo stock",
  agotado: "Agotado",
} as const;

function formatDate(iso: string) {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("es-MX");
}

function expiryTone(iso: string) {
  if (!iso) return "";
  const days = (new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "text-red-600 dark:text-red-400 font-semibold";
  if (days <= 90) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "";
}

const same = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export function inventoryHref(item: InventoryItem) {
  const search = `&buscar=${encodeURIComponent(item.sku)}`;
  if (item.itemKind === "equipo" || item.category === "equipos") {
    return `/dashboard/almacen?tab=equipo${search}`;
  }
  const category = isSupplyCategory(item.category) ? `&categoria=${item.category}` : "";
  return `/dashboard/almacen?tab=inventario${category}${search}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

type ScannedProductProps = {
  match: ScanMatch;
  onNavigate: () => void;
};

export function ScannedProduct({ match, onNavigate }: ScannedProductProps) {
  const { item } = match;
  const router = useRouter();
  const access = useSessionAccess();
  const canView = !access.ready || access.canView(inventoryModuleForCategory(item.category));
  const [stock, setStock] = useState<InventoryStock | undefined>();
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");
  const [labelFormat, setLabelFormat] = useState<LabelFormat>("thermal");
  const [copies, setCopies] = useState(1);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    getInventoryStock(undefined, item.id)
      .then((map) => {
        if (!cancelled) setStock(map.get(item.id));
      })
      .catch((reason) => {
        if (!cancelled) {
          setStockError(reason instanceof Error ? reason.message : "No se pudo cargar.");
        }
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, canView]);

  const categoryLabel =
    INVENTORY_CATEGORIES.find((entry) => entry.id === item.category)?.label ?? item.category;
  const status = getStockStatus(item.quantity, item.minStock);
  const placements = placementsFor(stock);
  const tracking = trackingFor(stock);
  const lots = tracking?.lots ?? [];
  const serials = tracking?.serials ?? [];
  const scanDetails = [
    match.lotNumber ? `Lote ${match.lotNumber}` : "",
    match.expiryDate ? `Caduca ${formatDate(match.expiryDate)}` : "",
    match.serialNumber ? `Serie ${match.serialNumber}` : "",
  ].filter(Boolean);

  async function printLabel() {
    setPrinting(true);
    try {
      await printProductLabels([item], { format: labelFormat, copies });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted sm:size-28">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
          ) : (
            <Package className="size-10 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono font-semibold">
              {item.sku}
            </span>
            <span className="rounded-md border border-border px-2 py-0.5">{categoryLabel}</span>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">
              {SCAN_MATCH_LABELS[match.kind]}
            </span>
            {!item.isActive ? (
              <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-red-700 dark:text-red-300">
                Inactivo
              </span>
            ) : null}
          </div>
          <p className="text-base leading-snug font-semibold text-foreground sm:text-lg">
            {item.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {[item.brand, catalogModelLabel(item.model), item.partNumber && `N.º parte ${item.partNumber}`]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {item.barcodes?.length ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {item.barcodes.map((code) => (
                <span
                  key={code}
                  className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]"
                >
                  {code}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {scanDetails.length ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">Código leído:</span> {scanDetails.join(" · ")}
        </div>
      ) : null}

      {!canView ? (
        <p className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Tu rol no puede consultar las existencias de esta categoría.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Existencia total</p>
              <p className="text-2xl font-semibold tabular-nums">
                {item.quantity.toLocaleString("es-MX")}{" "}
                <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
              </p>
              <span className={cn("mt-1 inline-block rounded-md px-2 py-0.5 text-xs", STATUS_STYLES[status])}>
                {STATUS_TEXT[status]}
              </span>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Stock mínimo</p>
              <p className="text-2xl font-semibold tabular-nums">
                {item.minStock.toLocaleString("es-MX")}
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-border p-3 sm:col-span-1">
              <p className="text-xs text-muted-foreground">
                {item.tracksSerial ? "Series activas" : "Lotes con existencia"}
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {stockLoading ? "…" : item.tracksSerial ? serials.length : lots.length}
              </p>
            </div>
          </div>

          {stockError ? <p className="text-sm text-destructive">{stockError}</p> : null}

          <Section title="Existencias por ubicación">
            {stockLoading ? (
              <p className="text-sm text-muted-foreground">Cargando existencias…</p>
            ) : placements.length ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <Th className="px-3 py-2 text-left font-medium">Almacén</Th>
                      <Th className="px-3 py-2 text-left font-medium">Ubicación</Th>
                      <Th className="px-3 py-2 text-right font-medium">Cantidad</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements.map((placement) => (
                      <tr
                        key={`${placement.warehouseId}-${placement.locationName}`}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2">{placement.warehouseName || placement.warehouseCode}</td>
                        <td className="px-3 py-2">
                          {placement.unplaced ? (
                            <span className="text-muted-foreground">Sin ubicar</span>
                          ) : (
                            placement.locationName
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums">
                          {placement.quantity.toLocaleString("es-MX")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin existencias registradas en almacenes.</p>
            )}
          </Section>

          {lots.length ? (
            <Section title="Lotes">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs text-muted-foreground">
                    <tr>
                      <Th className="px-3 py-2 text-left font-medium">Lote</Th>
                      <Th className="px-3 py-2 text-left font-medium">Caducidad</Th>
                      <Th className="px-3 py-2 text-right font-medium">Cantidad</Th>
                      <Th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Ubicación</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot) => (
                      <tr
                        key={lot.lotNumber}
                        className={cn(
                          "border-t border-border",
                          same(lot.lotNumber, match.lotNumber) && "bg-primary/10"
                        )}
                      >
                        <td className="px-3 py-2 font-mono">{lot.lotNumber}</td>
                        <td className={cn("px-3 py-2", expiryTone(lot.expiryDate))}>
                          {formatDate(lot.expiryDate)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {lot.quantity.toLocaleString("es-MX")}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                          {lot.locations.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          {serials.length ? (
            <Section title={`Números de serie (${serials.length})`}>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border text-sm">
                {serials.map((serial) => (
                  <li
                    key={serial.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 px-3 py-2",
                      same(serial.serialNumber, match.serialNumber) && "bg-primary/10"
                    )}
                  >
                    <span className="font-mono">{serial.serialNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {[SERIAL_STATUS_LABELS[serial.status] ?? serial.status, serial.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      )}

      <Section title="Etiqueta QR">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Formato
            <select
              value={labelFormat}
              onChange={(event) => setLabelFormat(event.target.value as LabelFormat)}
              className="h-10 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
            >
              {LABEL_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Copias
            <input
              type="number"
              min={1}
              max={200}
              value={copies}
              onChange={(event) => setCopies(Math.max(1, Number(event.target.value) || 1))}
              className="h-10 w-20 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => void printLabel()}
            disabled={printing}
            className="touch-target h-10"
          >
            <Printer className="mr-1.5 size-4" />
            {printing ? "Generando…" : "Imprimir etiqueta"}
          </Button>
          {canView ? (
            <Button
              type="button"
              onClick={() => {
                onNavigate();
                router.push(inventoryHref(item));
              }}
              className="touch-target h-10 sm:ml-auto"
            >
              <ExternalLink className="mr-1.5 size-4" />
              Ver en inventario
            </Button>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
