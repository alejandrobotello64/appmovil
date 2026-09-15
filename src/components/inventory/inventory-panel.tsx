"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { InventoryStats } from "@/components/inventory/inventory-stats";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItems,
  getStockStatus,
  updateInventoryItem,
} from "@/lib/inventory/storage";
import {
  ASSET_STATUS_OPTIONS,
  CATALOG_CATEGORIES,
  INVENTORY_CATEGORIES,
  PRODUCT_CATEGORIES,
  categoryToItemKind,
  type InventoryCategoryId,
  type InventoryItem,
  type InventoryItemInput,
  type ItemKind,
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
  return (
    INVENTORY_CATEGORIES.find((item) => item.id === category)?.label ?? category
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

type InventoryPanelProps = {
  initialCategory?: string | null;
  itemKind?: ItemKind;
  /** Catálogo de productos con filtros por categoría (incluye equipos) */
  catalogMode?: boolean;
};

export function InventoryPanel({
  initialCategory = null,
  itemKind = "producto",
  catalogMode = false,
}: InventoryPanelProps) {
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
  const isEquipment = !catalogMode && itemKind === "equipo";
  const categoryOptions = catalogMode
    ? CATALOG_CATEGORIES
    : isEquipment
      ? INVENTORY_CATEGORIES.filter((item) => item.id === "equipos")
      : PRODUCT_CATEGORIES;

  const formItemKind: ItemKind = catalogMode
    ? editingItem
      ? editingItem.itemKind
      : categoryFilter === "equipos"
        ? "equipo"
        : "producto"
    : itemKind;

  async function handleSubmit(data: InventoryItemInput) {
    try {
      setError("");
      const payload: InventoryItemInput = {
        ...data,
        itemKind: catalogMode
          ? categoryToItemKind(data.category)
          : itemKind,
        category:
          catalogMode && categoryToItemKind(data.category) === "equipo"
            ? "equipos"
            : data.category,
      };
      if (editingItem) {
        await updateInventoryItem(editingItem.id, payload);
      } else {
        await createInventoryItem(payload);
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

  useEffect(() => {
    if (!initialCategory) {
      setCategoryFilter("all");
      return;
    }
    const valid = categoryOptions.some((item) => item.id === initialCategory);
    if (valid) {
      setCategoryFilter(initialCategory as InventoryCategoryId);
    }
  }, [initialCategory, categoryOptions]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = getStockStatus(item.quantity, item.minStock);
      const matchesSearch =
        search.trim().length === 0 ||
        [item.sku, item.name, item.brand, item.model, item.supplier, item.serialNumber]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        isEquipment ||
        item.itemKind === "equipo" ||
        statusFilter === "all" ||
        status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter, isEquipment]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const category of categoryOptions) {
      counts[category.id] = items.filter(
        (item) => item.category === category.id
      ).length;
    }
    return counts;
  }, [items, categoryOptions]);

  async function refreshItems() {
    try {
      setLoading(true);
      setError("");
      const data = catalogMode
        ? await getInventoryItems()
        : await getInventoryItems({ kind: itemKind });
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

  useEffect(() => {
    void refreshItems();
  }, [itemKind, catalogMode]);

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
    <>
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
                {isEquipment
                  ? "Equipos médicos"
                  : catalogMode
                    ? "Catálogo de productos"
                    : "Productos consumibles"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEquipment
                  ? "Activos con número de serie, estado operativo y mantenimiento."
                  : catalogMode
                    ? "Identifica por equipos, refacciones, accesorios, insumos y medicamentos."
                    : "Insumos, medicamentos, refacciones, accesorios y reactivos."}
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
              {isEquipment ? "Nuevo equipo" : "Nuevo producto"}
            </Button>
          </div>

          {catalogMode || !isEquipment ? (
            <div className="hidden flex-wrap gap-2 border-b border-border px-4 py-3 md:flex">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  categoryFilter === "all"
                    ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                Todos ({categoryCounts.all ?? 0})
              </button>
              {categoryOptions.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setCategoryFilter(category.id as InventoryCategoryId)
                  }
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    categoryFilter === category.id
                      ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {category.label} ({categoryCounts[category.id] ?? 0})
                </button>
              ))}
            </div>
          ) : null}

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
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            {!isEquipment ? (
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
            ) : (
              <div />
            )}
          </div>

          <ResponsiveDataList
            emptyMessage="No hay productos que coincidan con los filtros."
            items={filteredItems.map((item) => {
              const status = getStockStatus(item.quantity, item.minStock);
              return {
                key: item.id,
                title: item.name,
                subtitle: `${item.sku} · ${item.brand}${item.model ? ` · ${item.model}` : ""}`,
                badge:
                  item.itemKind === "equipo" ? (
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                      {ASSET_STATUS_OPTIONS.find((s) => s.id === item.assetStatus)
                        ?.label ?? item.assetStatus}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLES[status]
                      )}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  ),
                fields: [
                  {
                    label: isEquipment ? "Serie" : "Categoría",
                    value: isEquipment
                      ? item.serialNumber || "Sin serie"
                      : getCategoryLabel(item.category),
                  },
                  {
                    label: isEquipment ? "Próx. mant." : "Stock",
                    value:
                      item.itemKind === "equipo"
                        ? item.nextMaintenanceDate || "—"
                        : `${item.quantity} ${item.unit} (mín. ${item.minStock})`,
                  },
                  { label: "Ubicación", value: item.location || "—" },
                  { label: "Precio", value: formatCurrency(item.unitPrice) },
                ],
                actions: (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar
                    </button>
                  </>
                ),
              };
            })}
          />

          <DesktopTable>
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">
                    {isEquipment ? "Equipo" : "Producto"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isEquipment ? "Serie" : "Categoría"}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {isEquipment ? "Estado" : "Stock"}
                  </th>
                  {!isEquipment ? (
                    <th className="px-4 py-3 font-medium">Alerta</th>
                  ) : (
                    <th className="px-4 py-3 font-medium">Próx. mant.</th>
                  )}
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
                        <td className="px-4 py-3 font-mono text-xs">
                          {item.sku}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.brand}
                            {item.model ? ` · ${item.model}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                            {getCategoryLabel(item.category)}
                          </span>
                          {item.itemKind === "equipo" ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Activo · {item.serialNumber || "Sin serie"}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {item.itemKind === "equipo" ? (
                            <span className="text-sm">
                              {ASSET_STATUS_OPTIONS.find(
                                (status) => status.id === item.assetStatus
                              )?.label ?? item.assetStatus}
                            </span>
                          ) : (
                            <>
                              {item.quantity} {item.unit}
                              <p className="text-xs text-muted-foreground">
                                mín. {item.minStock}
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.itemKind === "equipo" ? (
                            <span className="text-sm text-muted-foreground">
                              {item.nextMaintenanceDate || "—"}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                STATUS_STYLES[status]
                              )}
                            >
                              {STATUS_LABELS[status]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.location || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(item.unitPrice)}
                        </td>
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
          </DesktopTable>
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
                {editingItem
                  ? isEquipment
                    ? "Editar equipo"
                    : "Editar producto"
                  : isEquipment
                    ? "Nuevo equipo médico"
                    : "Nuevo producto consumible"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isEquipment
                  ? "Los equipos se gestionan como activos, no como stock consumible."
                  : "Los productos consumibles controlan existencias y caducidad."}
              </p>
            </div>
            <InventoryForm
              item={editingItem}
              itemKind={
                catalogMode
                  ? editingItem
                    ? editingItem.itemKind
                    : formItemKind
                  : itemKind
              }
              catalogCategories={catalogMode}
              onSubmit={handleSubmit}
              onCancel={() => {
                setFormOpen(false);
                setEditingItem(null);
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
