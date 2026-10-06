"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { createPurchaseRequest } from "@/lib/compras/storage";
import {
  PURCHASE_REQUEST_REASONS,
  type PurchaseRequestReason,
} from "@/lib/compras/types";
import {
  SUPPLY_CATEGORIES,
  type InventoryItem,
  type SupplyCategoryId,
} from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

type DraftLine = {
  itemId: string;
  itemSku: string;
  itemName: string;
  unit: string;
  quantity: number;
};

type CategoryFilter = SupplyCategoryId | "all";

type NewPurchaseRequestFormProps = {
  products: InventoryItem[];
  onCancel: () => void;
  onCreated: () => Promise<void> | void;
};

function productMatches(item: InventoryItem, query: string) {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  const haystack = [item.sku, item.name, item.brand, item.model, item.partNumber]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20";

export function NewPurchaseRequestForm({
  products,
  onCancel,
  onCreated,
}: NewPurchaseRequestFormProps) {
  const [reason, setReason] = useState<PurchaseRequestReason>("sin_existencia");
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
        },
      ];
    });
    setQuantity(1);
    setHint(`Agregado ${product.sku} · ${qty} ${product.unit}`);
    setError("");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (lines.length === 0) {
      setError("Agrega al menos un producto que no se pudo surtir.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const session = getSession();
      if (!session?.username) {
        throw new Error("Inicia sesión para solicitar la compra.");
      }
      await createPurchaseRequest({
        requestedBy: session.username,
        reason,
        warehouseNotes: notes,
        sourceType: "manual",
        lines: lines.map((line) => ({
          productId: line.itemId,
          productSku: line.itemSku,
          productName: line.itemName,
          quantity: line.quantity,
          unit: line.unit,
        })),
      });
      await onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canCreate = lines.length > 0 && !submitting;

  return (
    <form
      onSubmit={handleCreate}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Solicitar compra a Compras</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Usa esta orden cuando almacén no pueda surtir el producto.
            Compras verá el seguimiento hasta el pedido y la recepción.
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
            {submitting ? "Enviando..." : "Enviar a compras"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:px-5">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Motivo</span>
            <select
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as PurchaseRequestReason)
              }
              className={fieldClass}
            >
              {PURCHASE_REQUEST_REASONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notas para compras</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#3B46A5]"
              placeholder="Qué se necesita, para qué orden o por qué no se pudo surtir."
            />
          </label>
          <div className="flex items-center gap-2">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar SKU o nombre"
                className={cn(fieldClass, "pl-8")}
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as CategoryFilter)
              }
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="all">Todas</option>
              {SUPPLY_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="h-10 w-20 rounded-lg border border-input bg-background px-2 text-sm"
            />
          </div>
          {hint ? (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{hint}</p>
          ) : null}
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {matches.length === 0 ? (
              <li className="px-3 py-6 text-sm text-muted-foreground">
                No hay coincidencias en el catálogo.
              </li>
            ) : (
              matches.map((product) => (
                <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {product.sku} · exist. {product.quantity} {product.unit}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => addProduct(product)}
                  >
                    <Plus className="size-3.5" />
                    Agregar
                  </Button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Productos a comprar</h3>
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Aún no hay líneas. Agrega lo que almacén no puede surtir.
            </p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line) => (
                <li
                  key={line.itemId}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.itemName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {line.itemSku}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() =>
                        setLines((current) =>
                          current.map((item) =>
                            item.itemId === line.itemId
                              ? { ...item, quantity: Math.max(1, item.quantity - 1) }
                              : item
                          )
                        )
                      }
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.itemId === line.itemId
                              ? {
                                  ...item,
                                  quantity: Math.max(1, Number(event.target.value)),
                                }
                              : item
                          )
                        )
                      }
                      className="h-8 w-14 rounded-lg border border-input bg-background px-1 text-center text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() =>
                        setLines((current) =>
                          current.map((item) =>
                            item.itemId === line.itemId
                              ? { ...item, quantity: item.quantity + 1 }
                              : item
                          )
                        )
                      }
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-8 p-0"
                      onClick={() =>
                        setLines((current) =>
                          current.filter((item) => item.itemId !== line.itemId)
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </form>
  );
}
