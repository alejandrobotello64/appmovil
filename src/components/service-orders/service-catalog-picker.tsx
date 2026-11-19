"use client";
import { Ui } from "@/components/ui/ui-text";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { getStockStatus } from "@/lib/inventory/storage";
import {
  placementsFor,
  trackingFor,
  type InventoryStock,
} from "@/lib/inventory/tracking";
import {
  INVENTORY_CATEGORIES,
  type InventoryItem,
} from "@/lib/inventory/types";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import { matchesSearch } from "@/lib/search";
import { useScanResolved } from "@/lib/scan/use-scan-resolved";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  disponible: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  bajo_stock: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  agotado: "bg-destructive/10 text-destructive",
} as const;

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function categoryLabel(category: string) {
  return INVENTORY_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function productMatches(item: InventoryItem, query: string) {
  return matchesSearch(query, [
    item.sku,
    item.name,
    item.description,
    item.brand,
    item.model,
    item.partNumber,
  ]);
}

export function ServiceStockBadge({
  item,
  className,
}: {
  item: InventoryItem;
  className?: string;
}) {
  const status = getStockStatus(item.quantity, item.minStock);
  const label =
    status === "agotado"
      ? "Sin existencia"
      : status === "bajo_stock"
        ? "Bajo stock"
        : "En existencia";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        STATUS_STYLES[status],
        className
      )}
    >
      {formatQty(item.quantity)} {item.unit} · {label}
    </span>
  );
}

export function ServiceStockDetail({
  item,
  stock,
}: {
  item: InventoryItem;
  stock?: InventoryStock;
}) {
  const placements = placementsFor(stock);
  const lots = trackingFor(stock)?.lots ?? [];
  if (!placements.length && !lots.length) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {item.quantity > 0
          ? `${formatQty(item.quantity)} ${item.unit} en existencia (sin desglose de almacén).`
          : "Este código no tiene existencia registrada."}
      </p>
    );
  }
  return (
    <div className="space-y-2 text-[11px]">
      {placements.length ? (
        <ul className="space-y-1">
          {placements.map((place) => (
            <li
              key={`${place.warehouseId}-${place.locationName}`}
              className="flex justify-between gap-3"
            >
              <span className="min-w-0 truncate text-muted-foreground">
                {place.warehouseCode}
                {place.locationName ? ` · ${place.locationName}` : ""}
                {place.unplaced ? " (sin ubicar)" : ""}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {formatQty(place.quantity)} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {lots.length ? (
        <ul className="space-y-1 border-t border-border/70 pt-2">
          {lots.slice(0, 6).map((lot) => (
            <li
              key={lot.lot?.id || lot.lotNumber}
              className="flex justify-between gap-3"
            >
              <span className="min-w-0 truncate text-muted-foreground">
                Lote {lot.lotNumber || "s/n"}
                {lot.expiryDate
                  ? ` · cad. ${new Date(`${lot.expiryDate}T12:00:00`).toLocaleDateString("es-MX")}`
                  : ""}
              </span>
              <span className="shrink-0 tabular-nums">
                {formatQty(lot.quantity)} {item.unit}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type ServiceCatalogPickerProps = {
  products: InventoryItem[];
  stockByProduct?: Map<string, InventoryStock> | null;
  disabled?: boolean;
  onAdd: (item: InventoryItem) => void;
};

export function ServiceCatalogPicker({
  products,
  stockByProduct,
  disabled,
  onAdd,
}: ServiceCatalogPickerProps) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState("");

  const matches = useMemo(() => {
    const term = query.trim();
    if (!term) return [];
    return products
      .filter((item) => item.isActive && productMatches(item, term))
      .slice(0, 12);
  }, [products, query]);

  function add(item: InventoryItem) {
    onAdd(item);
    setQuery("");
    setOpenId(null);
  }

  const onCatalogScan = useCallback(
    ({
      match,
      raw,
    }: {
      match: { item: InventoryItem } | null;
      raw: string;
    }) => {
      if (disabled) return;
      const product =
        (match && products.find((item) => item.id === match.item.id)) ||
        products.find(
          (item) =>
            item.isActive &&
            (item.sku.toUpperCase() === raw.trim().toUpperCase() ||
              (item.partNumber || "").toUpperCase() === raw.trim().toUpperCase())
        );
      if (!product) {
        setQuery(raw.trim());
        setScanHint("Código leído sin producto en catálogo. Revisa o busca manualmente.");
        return;
      }
      add(product);
      setScanHint(`Agregado: ${product.sku} — ${product.name}`);
    },
    // add uses onAdd/setState; products+disabled are the scan gate
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, products, onAdd]
  );
  useScanResolved(onCatalogScan, { enabled: !disabled });

  return (
    <div className="space-y-2">
      <SearchInput
        value={query}
        onChange={(value) => {
          setQuery(value);
          setOpenId(null);
          setScanHint("");
        }}
        scanSearch="true"
        placeholder="Buscar o escanear por código MAS o descripción…"
        className={disabled ? "pointer-events-none opacity-60" : undefined}
      />
      {scanHint ? (
        <p className="text-xs font-medium text-[#00BFFF]">{scanHint}</p>
      ) : null}
      {!query.trim() ? (
        <p className="text-xs text-muted-foreground">
          Escanea o escribe el código. No hace falta elegir si es insumo, refacción o accesorio.
        </p>
      ) : matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          No hay productos con ese código o descripción. Agrega una línea libre si el material no está en el catálogo.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {matches.map((item) => {
            const open = openId === item.id;
            return (
              <li key={item.id} className="bg-card">
                <div className="flex items-start gap-2 px-3 py-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenId(open ? null : item.id)}
                    aria-expanded={open}
                  >
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="font-mono text-foreground">{item.sku}</span>
                      <span>{categoryLabel(item.category)}</span>
                      {item.brand ? <span>{item.brand}</span> : null}
                      <span>{catalogModelLabel(item.model)}</span>
                      {item.partNumber ? <span>Ref. {item.partNumber}</span> : null}
                      <ServiceStockBadge item={item} />
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-0.5 shrink-0"
                    disabled={disabled}
                    onClick={() => add(item)}
                  >
                    <Plus className="size-3.5" /> <Ui>Agregar</Ui></Button>
                </div>
                {open ? (
                  <div className="border-t border-border/70 bg-muted/20 px-3 py-2">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-medium">
                      <ChevronDown className="size-3" /> Existencias
                    </p>
                    <ServiceStockDetail
                      item={item}
                      stock={stockByProduct?.get(item.id)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ServiceLineStockCell({
  item,
  stock,
  requested,
}: {
  item: InventoryItem | undefined;
  stock?: InventoryStock;
  requested: number;
}) {
  const [open, setOpen] = useState(false);
  if (!item) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const short = requested > 0 && item.quantity < requested;
  return (
    <div className="min-w-[9rem]">
      <button
        type="button"
        className="flex flex-col items-start gap-1 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Existencias de ${item.sku}`}
      >
        <ServiceStockBadge item={item} />
        {short ? (
          <span className="text-[10px] font-medium text-destructive">
            Pedido {formatQty(requested)} {item.unit}: no alcanza
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="mt-2 rounded-lg border border-border bg-muted/20 p-2">
          <ServiceStockDetail item={item} stock={stock} />
        </div>
      ) : null}
    </div>
  );
}
