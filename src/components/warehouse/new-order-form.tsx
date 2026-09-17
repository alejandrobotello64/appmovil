"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Minus, PackagePlus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getStockStatus } from "@/lib/inventory/storage";
import {
  SUPPLY_CATEGORIES,
  type InventoryItem,
  type SupplyCategoryId,
} from "@/lib/inventory/types";
import type { Supplier } from "@/lib/suppliers/types";
import { createPurchaseOrder } from "@/lib/warehouse/orders";
import { cn } from "@/lib/utils";

type DraftLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

type CategoryFilter = SupplyCategoryId | "all";

type NewOrderFormProps = {
  products: InventoryItem[];
  suppliers: Supplier[];
  onCancel: () => void;
  onCreated: () => Promise<void> | void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function categoryLabel(category: string) {
  return (
    SUPPLY_CATEGORIES.find((item) => item.id === category)?.label ?? category
  );
}

function productMatches(item: InventoryItem, query: string) {
  const parts = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return true;
  const haystack = [
    item.sku,
    item.name,
    item.brand,
    item.model,
    item.partNumber,
    item.supplier,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20";

export function NewOrderForm({
  products,
  suppliers,
  onCancel,
  onCreated,
}: NewOrderFormProps) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [quantity, setQuantity] = useState(1);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const matches = useMemo(() => {
    const filtered = products.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      return productMatches(item, query);
    });
    const browsing = query.trim().length === 0;
    return browsing ? filtered.slice(0, 12) : filtered.slice(0, 20);
  }, [products, query, categoryFilter]);

  const lineTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines]
  );
  const lineCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  function addProduct(product: InventoryItem) {
    const qty = Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
    setLines((current) => {
      const existing = current.find((line) => line.itemId === product.id);
      if (existing) {
        return current.map((line) =>
          line.itemId === product.id
            ? { ...line, quantity: line.quantity + qty }
            : line
        );
      }
      return [
        ...current,
        {
          itemId: product.id,
          itemSku: product.sku,
          itemName: product.name,
          unit: product.unit,
          quantity: qty,
          unitPrice: product.unitPrice,
        },
      ];
    });
    setQuantity(1);
    setHint(`Agregado ${product.sku} · ${qty} ${product.unit}`);
    setError("");
  }

  function updateLine(itemId: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) =>
        line.itemId === itemId ? { ...line, ...patch } : line
      )
    );
  }

  function removeLine(itemId: string) {
    setLines((current) => current.filter((line) => line.itemId !== itemId));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setError("Agrega al menos un producto al pedido.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const supplier = suppliers.find((item) => item.id === supplierId);
      const session = getSession();
      await createPurchaseOrder({
        supplierId: supplier?.id ?? null,
        supplierName: supplier?.name ?? "Sin proveedor",
        expectedDate,
        notes,
        createdBy: session?.username ?? "",
        items: lines,
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el pedido");
    } finally {
      setSubmitting(false);
    }
  }

  const canCreate = lines.length > 0 && !submitting;

  return (
    <form
      onSubmit={handleCreate}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:min-h-[calc(100dvh-7rem)]"
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Nuevo pedido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Busca por código MAS o nombre, arma las líneas y confirma la orden.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
            Volver
          </Button>
          <Button
            type="submit"
            disabled={!canCreate}
            className="h-9 border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90 disabled:opacity-40"
          >
            {submitting ? "Creando..." : "Crear pedido"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:px-5">
          {error}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="space-y-4 overflow-y-auto border-b border-border p-4 sm:p-5 lg:border-r lg:border-b-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Proveedor</span>
              {suppliers.length === 0 ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                  No hay proveedores activos. Puedes crear el pedido sin
                  proveedor o{" "}
                  <Link
                    href="/dashboard/almacen?tab=proveedores"
                    className="font-medium underline underline-offset-2"
                  >
                    dar de alta uno
                  </Link>
                  .
                </p>
              ) : (
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Fecha esperada</span>
              <input
                type="date"
                value={expectedDate}
                onChange={(event) => setExpectedDate(event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Notas</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Referencia, urgencia o área que solicita..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm font-medium">Catálogo</p>
              <p className="text-xs text-muted-foreground">
                {products.length.toLocaleString("es-MX")} productos
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-medium",
                  categoryFilter === "all"
                    ? "bg-[#3B46A5] text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </button>
              {SUPPLY_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryFilter(category.id)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-medium",
                    categoryFilter === category.id
                      ? "bg-[#3B46A5] text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_5.5rem] items-end gap-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Buscar producto
                </span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    name="catalogQuery"
                    data-catalog-search="true"
                    value={query}
                    autoFocus
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="SKU, nombre o marca"
                    className={`${fieldClass} pl-10`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        if (matches[0]) addProduct(matches[0]);
                      }
                    }}
                  />
                </span>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Cant.
                </span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(1, Number(event.target.value) || 1))
                  }
                  className={fieldClass}
                />
              </label>
            </div>
            {hint ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{hint}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Escribe para filtrar o elige una categoría. Enter agrega el
                primer resultado.
              </p>
            )}
            <ul className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background lg:max-h-none">
              {matches.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {products.length === 0
                    ? "No hay productos consumibles en el catálogo."
                    : "Sin coincidencias. Prueba otro código o nombre."}
                </li>
              ) : (
                matches.map((product) => {
                  const status = getStockStatus(product.quantity, product.minStock);
                  const already = lines.find((line) => line.itemId === product.id);
                  return (
                    <li key={product.id} className="border-b border-border/70 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/70"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {product.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                            {product.sku}
                            {product.brand ? ` · ${product.brand}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs text-muted-foreground">
                            {categoryLabel(product.category)}
                          </span>
                          <span className="block text-xs">
                            {product.quantity} {product.unit}
                            {status === "bajo_stock" ? " · bajo" : ""}
                            {status === "agotado" ? " · agotado" : ""}
                          </span>
                          {already ? (
                            <span className="text-[11px] font-medium text-[#3B46A5]">
                              En pedido: {already.quantity}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {formatCurrency(product.unitPrice)}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </section>

        <section className="flex min-h-[280px] flex-col p-4 sm:p-5">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Líneas del pedido</h3>
            <p className="text-xs text-muted-foreground">
              {lines.length === 0
                ? "Ningún artículo"
                : `${lines.length} SKU · ${lineCount} pzas`}
            </p>
          </div>

          {lines.length === 0 ? (
            <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
              <PackagePlus className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Aún no hay líneas</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Busca un insumo, medicamento o accesorio en el catálogo y
                tócalo para agregarlo.
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <ul className="space-y-2 md:hidden">
                {lines.map((line) => (
                  <li
                    key={line.itemId}
                    className="rounded-xl border border-border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{line.itemName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {line.itemSku}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.itemId)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Quitar ${line.itemName}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2">
                      <div className="inline-flex items-center rounded-lg border border-input">
                        <button
                          type="button"
                          className="inline-flex size-9 items-center justify-center"
                          onClick={() =>
                            updateLine(line.itemId, {
                              quantity: Math.max(1, line.quantity - 1),
                            })
                          }
                          aria-label="Menos"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.itemId, {
                              quantity: Math.max(1, Number(event.target.value) || 1),
                            })
                          }
                          className="h-9 w-12 border-x border-input bg-transparent text-center text-sm outline-none"
                        />
                        <button
                          type="button"
                          className="inline-flex size-9 items-center justify-center"
                          onClick={() =>
                            updateLine(line.itemId, {
                              quantity: line.quantity + 1,
                            })
                          }
                          aria-label="Más"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <p className="text-right text-sm font-medium">
                        {formatCurrency(line.quantity * line.unitPrice)}
                      </p>
                    </div>
                    <label className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      Precio unitario
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateLine(line.itemId, {
                            unitPrice: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-right text-sm text-foreground outline-none"
                      />
                    </label>
                  </li>
                ))}
              </ul>

              <div className="hidden rounded-xl border border-border md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Producto</th>
                      <th className="px-3 py-2 font-medium">Cant.</th>
                      <th className="px-3 py-2 font-medium">P. unit.</th>
                      <th className="px-3 py-2 font-medium">Importe</th>
                      <th className="px-3 py-2 font-medium">
                        <span className="sr-only">Quitar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.itemId} className="border-t border-border/70">
                        <td className="px-3 py-2">
                          <p className="font-medium">{line.itemName}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {line.itemSku}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(event) =>
                              updateLine(line.itemId, {
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value) || 1
                                ),
                              })
                            }
                            className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(event) =>
                              updateLine(line.itemId, {
                                unitPrice: Math.max(
                                  0,
                                  Number(event.target.value) || 0
                                ),
                              })
                            }
                            className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-sm outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          {formatCurrency(line.quantity * line.unitPrice)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(line.itemId)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Quitar ${line.itemName}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="sticky bottom-0 mt-4 flex shrink-0 flex-col gap-3 border-t border-border bg-card pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Total estimado</p>
              <p className="text-xl font-semibold tabular-nums">
                {formatCurrency(lineTotal)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 sm:flex-none"
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!canCreate}
                className="h-10 flex-1 border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90 disabled:opacity-40 sm:min-w-40 sm:flex-none"
              >
                {submitting ? "Creando..." : "Crear pedido"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}
