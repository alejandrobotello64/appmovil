"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  QuoteLineStockHint,
  QuoteProductSearch,
} from "@/components/sales/quote-product-search";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  clampAmount,
  clampPercent,
  lineAmount,
  lineDiscountAmount,
  lineGrossAmount,
  lineHasDiscount,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none";

export type QuoteDraftLine = {
  key: string;
  productId?: string | null;
  description: string;
  brand?: string;
  partNumber?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  discountMode?: "amount" | "percent";
  notes?: string;
};

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function emptyQuoteDraftLine(): QuoteDraftLine {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    unit: "pza",
    productId: null,
    brand: "",
    partNumber: "",
    discountMode: "percent",
    discountPercent: 0,
    discountAmount: 0,
  };
}

function applyProduct(
  line: QuoteDraftLine,
  product: InventoryItem | null
): QuoteDraftLine {
  if (!product) return { ...line, productId: null };
  return {
    ...line,
    productId: product.id,
    description: line.description.trim() ? line.description : product.name,
    unit: product.unit || line.unit || "pza",
    unitPrice: product.unitPrice || line.unitPrice,
    brand: product.brand,
    partNumber: product.partNumber,
  };
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type QuoteLinesEditorProps = {
  lines: QuoteDraftLine[];
  onChange: (lines: QuoteDraftLine[]) => void;
  items: InventoryItem[];
  availableById: Map<string, number>;
  disabled?: boolean;
};

export function QuoteLinesEditor({
  lines,
  onChange,
  items,
  availableById,
  disabled,
}: QuoteLinesEditorProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function update(index: number, patch: Partial<QuoteDraftLine>) {
    onChange(lines.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function changeDiscountMode(index: number, mode: "amount" | "percent") {
    const row = lines[index];
    if (!row || (row.discountMode ?? "percent") === mode) return;
    update(index, {
      discountMode: mode,
      discountPercent: 0,
      discountAmount: 0,
    });
  }

  function updateDiscount(index: number, value: string) {
    const row = lines[index];
    if (!row) return;
    if (row.discountMode === "amount") {
      update(index, {
        discountPercent: 0,
        discountAmount: clampAmount(value),
      });
    } else {
      update(index, {
        discountPercent: clampPercent(value),
        discountAmount: 0,
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">Partidas</h4>
          <p className="text-xs text-muted-foreground">
            Ordena con ↑ ↓, duplica o quita. Expande una fila para marca y referencia.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-8"
          disabled={disabled}
          onClick={() => onChange([...lines, emptyQuoteDraftLine()])}
        >
          <Plus className="size-3.5" />
          Agregar partida
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="hidden grid-cols-[2.25rem_minmax(0,1.4fr)_4.5rem_6.5rem_6.5rem_minmax(5.5rem,auto)_auto] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground md:grid">
          <span>#</span>
          <span>Producto / descripción</span>
          <span>Cant.</span>
          <span>P. unit.</span>
          <span>Desc.</span>
          <span>Importe</span>
          <span className="text-right">Acciones</span>
        </div>

        <ul className="divide-y divide-border">
          {lines.map((line, index) => {
            const catalogItem =
              items.find((item) => item.id === line.productId) ?? null;
            const available = catalogItem
              ? (availableById.get(catalogItem.id) ?? catalogItem.quantity)
              : 0;
            const isOpen = expanded[line.key] ?? !line.productId;
            const discountMode = line.discountMode ?? "percent";

            return (
              <li key={line.key} className="bg-card px-3 py-3">
                <div className="grid gap-2 md:grid-cols-[2.25rem_minmax(0,1.4fr)_4.5rem_6.5rem_6.5rem_minmax(5.5rem,auto)_auto] md:items-start">
                  <div className="flex items-center gap-1 md:flex-col md:pt-1">
                    <span className="inline-flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                      {index + 1}
                    </span>
                    <div className="flex md:flex-col">
                      <button
                        type="button"
                        disabled={disabled || index === 0}
                        onClick={() => onChange(moveItem(lines, index, index - 1))}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        aria-label="Subir partida"
                        title="Subir"
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || index === lines.length - 1}
                        onClick={() => onChange(moveItem(lines, index, index + 1))}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        aria-label="Bajar partida"
                        title="Bajar"
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <QuoteProductSearch
                      items={items}
                      availableById={availableById}
                      selectedId={line.productId ?? null}
                      disabled={disabled}
                      onSelect={(product) =>
                        update(index, applyProduct(line, product))
                      }
                    />
                    <label className="block space-y-1">
                      <span className="text-xs text-muted-foreground">
                        Descripción *
                      </span>
                      <input
                        required
                        disabled={disabled}
                        value={line.description}
                        onChange={(e) =>
                          update(index, { description: e.target.value })
                        }
                        className={fieldClass}
                        placeholder="Texto que verá el cliente en la cotización"
                      />
                    </label>
                  </div>

                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground md:sr-only">
                      Cant.
                    </span>
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      disabled={disabled}
                      value={line.quantity}
                      onChange={(e) =>
                        update(index, { quantity: Number(e.target.value) })
                      }
                      className={fieldClass}
                    />
                    <QuoteLineStockHint
                      item={catalogItem}
                      available={available}
                      requested={line.quantity}
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground md:sr-only">
                      P. unit.
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={disabled}
                      value={line.unitPrice}
                      onChange={(e) =>
                        update(index, { unitPrice: Number(e.target.value) })
                      }
                      className={fieldClass}
                    />
                  </label>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">
                        Desc. {discountMode === "amount" ? "$" : "%"}
                      </span>
                      <div
                        role="group"
                        aria-label="Tipo de descuento"
                        className="inline-flex rounded-md border border-input p-0.5 text-[10px]"
                      >
                        {(
                          [
                            { id: "amount", label: "$" },
                            { id: "percent", label: "%" },
                          ] as const
                        ).map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            aria-pressed={discountMode === option.id}
                            onClick={() => changeDiscountMode(index, option.id)}
                            className={cn(
                              "rounded px-1.5 font-semibold leading-4 transition-colors",
                              discountMode === option.id
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={
                        discountMode === "amount" ? lineGrossAmount(line) : 100
                      }
                      step="0.01"
                      disabled={disabled}
                      value={
                        (discountMode === "amount"
                          ? line.discountAmount
                          : line.discountPercent) || ""
                      }
                      placeholder="0"
                      onChange={(e) => updateDiscount(index, e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1 md:pt-5">
                    <p className="text-sm font-medium tabular-nums">
                      {lineHasDiscount(line) ? (
                        <>
                          <span className="mr-1 text-xs font-normal text-muted-foreground line-through">
                            {money(lineGrossAmount(line))}
                          </span>
                          {money(lineAmount(line))}
                        </>
                      ) : (
                        money(lineAmount(line))
                      )}
                    </p>
                    {lineHasDiscount(line) ? (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        −{money(lineDiscountAmount(line))}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1 md:pt-1">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [line.key]: !isOpen,
                        }))
                      }
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {isOpen ? "Menos" : "Más"}
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const copy: QuoteDraftLine = {
                          ...line,
                          key: crypto.randomUUID(),
                        };
                        const next = [...lines];
                        next.splice(index + 1, 0, copy);
                        onChange(next);
                      }}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Duplicar partida"
                      title="Duplicar"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={disabled || lines.length <= 1}
                      onClick={() =>
                        onChange(lines.filter((_, i) => i !== index))
                      }
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                      aria-label="Quitar partida"
                      title="Quitar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-3 grid gap-2 border-t border-dashed border-border pt-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">Marca</span>
                      <input
                        disabled={disabled}
                        value={line.brand ?? ""}
                        onChange={(e) => update(index, { brand: e.target.value })}
                        placeholder="Marca del producto"
                        className={fieldClass}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-muted-foreground">
                        Referencia / n.º de parte
                      </span>
                      <input
                        disabled={disabled}
                        value={line.partNumber ?? ""}
                        onChange={(e) =>
                          update(index, { partNumber: e.target.value })
                        }
                        placeholder="Referencia o n.º de parte"
                        className={fieldClass}
                      />
                    </label>
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-xs text-muted-foreground">
                        Nota de la partida (opcional)
                      </span>
                      <input
                        disabled={disabled}
                        value={line.notes ?? ""}
                        onChange={(e) => update(index, { notes: e.target.value })}
                        placeholder="Observación interna o para el PDF"
                        className={fieldClass}
                      />
                    </label>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
