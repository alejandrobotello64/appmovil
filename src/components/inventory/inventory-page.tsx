"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { InventoryStats } from "@/components/inventory/inventory-stats";
import { Button } from "@/components/ui/button";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
  getStockStatus,
  updateInventoryItem,
} from "@/lib/inventory/storage";
import {
  INVENTORY_CATEGORIES,
  type InventoryCategoryId,
  type InventoryItem,
  type InventoryItemInput,
  type StockStatus,
} from "@/lib/inventory/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<StockStatus, string> = {
  disponible: "Disponible",
  bajo_stock: "Bajo stock",
  agotado: "Agotado",
};

const STATUS_STYLES: Record<StockStatus, string> = {
  disponible: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  bajo_stock: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  agotado: "bg-destructive/10 text-destructive",
};

function getCategoryLabel(category: InventoryCategoryId) {
  return INVENTORY_CATEGORIES.find((item) => item.id === category)?.label ?? category;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function InventoryPage() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    InventoryCategoryId | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshItems();
  }, []);

  useEffect(() => {
    if (!categoryParam) return;
    const valid = INVENTORY_CATEGORIES.some((item) => item.id === categoryParam);
    if (valid) {
      setCategoryFilter(categoryParam as InventoryCategoryId);
    }
  }, [categoryParam]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = getStockStatus(item.quantity, item.minStock);
      const matchesSearch =
        search.trim().length === 0 ||
        [item.sku, item.name, item.brand, item.model, item.supplier]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

  async function refreshItems() {
    try {
      setLoading(true);
      setError("");
      const data = await getInventoryItems();
      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el inventario desde Supabase."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(data: InventoryItemInput) {
    try {
      setError("");
      if (editingItem) {
        await updateInventoryItem(editingItem.id, data);
      } else {
        await createInventoryItem(data);
      }
      await refreshItems();
      setFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el producto en Supabase."
      );
    }
  }

  function handleEdit(item: InventoryItem) {
    setEditingItem(item);
    setFormOpen(true);
  }

  async function handleDelete(item: InventoryItem) {
    const confirmed = window.confirm(
      `¿Eliminar "${item.name}" del inventario?`
    );
    if (!confirmed) return;
    try {
      setError("");
      await deleteInventoryItem(item.id);
      await refreshItems();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar el producto en Supabase."
      );
    }
  }

  return (
    <AppShell
      title="Inventario"
      subtitle="Medical Advanced Supplies"
    >
      <div className="space-y-6">
        <InventoryStats items={items} />

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Cargando inventario desde Supabase...
          </p>
        ) : null}

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Control de existencias
              </h2>
              <p className="text-sm text-muted-foreground">
                Administra insumos, refacciones, medicamentos, accesorios y equipos.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
            >
              <Plus className="size-4" />
              Nuevo producto
            </Button>
          </div>

          <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[1fr_auto_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por SKU, nombre, marca o proveedor..."
                className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value as InventoryCategoryId | "all"
                )
              }
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              <option value="all">Todas las categorías</option>
              {INVENTORY_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StockStatus | "all")
              }
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              <option value="all">Todos los estados</option>
              <option value="disponible">Disponible</option>
              <option value="bajo_stock">Bajo stock</option>
              <option value="agotado">Agotado</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No hay productos que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const status = getStockStatus(item.quantity, item.minStock);
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-border/70 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.brand}
                            {item.model ? ` · ${item.model}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {getCategoryLabel(item.category)}
                        </td>
                        <td className="px-4 py-3">
                          {item.quantity} {item.unit}
                          <p className="text-xs text-muted-foreground">
                            mín. {item.minStock}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              STATUS_STYLES[status]
                            )}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.location || "—"}
                        </td>
                        <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Editar ${item.name}`}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Eliminar ${item.name}`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-form-title"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-4">
              <h3
                id="inventory-form-title"
                className="text-lg font-semibold text-foreground"
              >
                {editingItem ? "Editar producto" : "Nuevo producto"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Registra insumos, refacciones, medicamentos, accesorios o equipos.
              </p>
            </div>
            <InventoryForm
              item={editingItem}
              onSubmit={handleSubmit}
              onCancel={() => {
                setFormOpen(false);
                setEditingItem(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
