"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { daysUntilExpiry } from "@/lib/inventory/expiry";
import { INVENTORY_CATEGORIES, type InventoryItem } from "@/lib/inventory/types";
import { matchesSearch } from "@/lib/search";
import { MOVEMENT_KIND_LABELS, type MovementKind } from "@/lib/warehouse/movements";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#00BFFF] focus:ring-2 focus:ring-[#00BFFF]/25 disabled:opacity-60";

export const primaryButtonClass =
  "w-full border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90 sm:w-fit";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function StepTitle({ step, title, children }: { step: number; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-xs text-white">
          {step}
        </span>
        {title}
      </h4>
      {children}
    </div>
  );
}

const KIND_STYLES: Record<MovementKind, string> = {
  entrada: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  salida: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  traspaso: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  cambio_ubicacion: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  canje_caducado: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  devolucion: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  ajuste: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export function KindBadge({ kind }: { kind: MovementKind }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        KIND_STYLES[kind] ?? KIND_STYLES.ajuste
      )}
    >
      {MOVEMENT_KIND_LABELS[kind] ?? kind}
    </span>
  );
}

export function ExpiryTag({ date }: { date: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const days = daysUntilExpiry(date);
  const [y, m, d] = date.split("-");
  const label = `${d}/${m}/${y}`;
  if (days === null) return <span>{label}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-sort={date}>
      <span>{label}</span>
      {days < 0 ? (
        <span className="rounded-full bg-destructive/10 px-1.5 text-[11px] font-medium text-destructive">
          Caducado
        </span>
      ) : days <= 30 ? (
        <span className="rounded-full bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          {days} d
        </span>
      ) : null}
    </span>
  );
}

export function categoryLabel(id: string) {
  return INVENTORY_CATEGORIES.find((item) => item.id === id)?.label ?? id;
}

export function Alert({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      )}
    >
      {children}
    </p>
  );
}

/** Buscador de producto por SKU, nombre, marca, modelo o número de parte. */
export function ProductPicker({
  products,
  value,
  onChange,
  placeholder = "Buscar por SKU, nombre, marca, modelo o n.º de parte...",
  disabled,
}: {
  products: InventoryItem[];
  value: InventoryItem | null;
  onChange: (item: InventoryItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return products
      .filter((item) =>
        matchesSearch(query, [item.sku, item.name, item.brand, item.model, item.partNumber])
      )
      .slice(0, 8);
  }, [products, query]);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-[#00BFFF]/40 bg-[#00BFFF]/5 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {value.partNumber.trim() ? `${value.name} · n.º ${value.partNumber.trim()}` : value.name}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{value.sku}</span> · {categoryLabel(value.category)} ·{" "}
            {value.quantity} {value.unit} en total
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" /> Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "pl-9")}
      />
      {query.trim() ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias.</p>
          ) : (
            matches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.partNumber.trim()
                      ? `${item.name} · n.º ${item.partNumber.trim()}`
                      : item.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{item.sku}</span> · {categoryLabel(item.category)}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs",
                    item.quantity > 0 ? "text-muted-foreground" : "text-destructive"
                  )}
                >
                  {item.quantity} {item.unit}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
