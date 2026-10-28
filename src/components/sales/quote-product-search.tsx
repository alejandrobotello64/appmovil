"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ServiceStockBadge } from "@/components/service-orders/service-catalog-picker";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import { INVENTORY_CATEGORIES, type InventoryItem } from "@/lib/inventory/types";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function categoryLabel(category: string) {
  return INVENTORY_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function withQty(item: InventoryItem, qty: number): InventoryItem {
  return item.quantity === qty ? item : { ...item, quantity: qty };
}

export function QuoteProductSearch({
  items,
  availableById,
  selectedId,
  disabled,
  onSelect,
}: {
  items: InventoryItem[];
  availableById: Map<string, number>;
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (item: InventoryItem | null) => void;
}) {
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedQty = selected
    ? (availableById.get(selected.id) ?? selected.quantity)
    : 0;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  const matches = useMemo(() => {
    const term = query.trim();
    if (!term) return [];
    return items
      .filter(
        (item) =>
          item.isActive &&
          matchesSearch(term, [
            item.sku,
            item.name,
            item.description,
            item.brand,
            item.model,
            item.partNumber,
            item.manufacturer,
          ])
      )
      .slice(0, 12);
  }, [items, query]);

  function pick(item: InventoryItem) {
    onSelect(item);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onSelect(null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="space-y-1.5">
      <span className="text-xs text-muted-foreground">Producto</span>
      {selected ? (
        <div className="rounded-lg border border-input bg-background px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selected.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="font-mono text-foreground">{selected.sku}</span>
                <span>{categoryLabel(selected.category)}</span>
                {selected.brand ? <span>{selected.brand}</span> : null}
                <span>{catalogModelLabel(selected.model)}</span>
                {selected.partNumber ? <span>Ref. {selected.partNumber}</span> : null}
              </p>
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={clear}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Quitar producto del catálogo"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mt-2">
            <ServiceStockBadge item={withQty(selected, selectedQty)} />
          </div>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) {
                event.preventDefault();
                pick(matches[0]);
              }
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder="SKU, nombre, marca o n.º de parte"
            aria-label="Buscar producto del catálogo"
            className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {open && query.trim() ? (
            <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  Sin coincidencias. Puedes dejar la partida libre y escribir la descripción.
                </li>
              ) : (
                matches.map((item) => {
                  const qty = availableById.get(item.id) ?? item.quantity;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => pick(item)}
                        className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left hover:bg-muted"
                      >
                        <span className="truncate text-sm font-medium">{item.name}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="font-mono text-foreground">{item.sku}</span>
                          {item.brand ? <span>{item.brand}</span> : null}
                          <span>{catalogModelLabel(item.model)}</span>
                          {item.partNumber ? <span>Ref. {item.partNumber}</span> : null}
                          <ServiceStockBadge item={withQty(item, qty)} />
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>
      )}
      {!selected ? (
        <p className="text-[11px] text-muted-foreground">
          Escribe para buscar en el catálogo. Si no está, deja este campo vacío y llena la descripción.
        </p>
      ) : null}
    </div>
  );
}

export function QuoteLineStockHint({
  item,
  available,
  requested,
}: {
  item: InventoryItem | null;
  available: number;
  requested: number;
}) {
  if (!item) return null;
  const short = requested > 0 && available < requested;
  return (
    <p
      className={cn(
        "text-[11px] tabular-nums",
        short ? "font-medium text-destructive" : "text-muted-foreground"
      )}
    >
      {formatQty(available)} {item.unit} en existencia
      {short ? ` · cotizas ${formatQty(requested)}, no alcanza` : ""}
    </p>
  );
}
