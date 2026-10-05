"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  ImagePlus,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Warehouse as WarehouseIcon,
  ZoomIn,
} from "lucide-react";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { InventoryStats } from "@/components/inventory/inventory-stats";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import {
  addInventoryItemImages,
  clearInventoryItemImage,
  createInventoryItem,
  deleteInventoryItem,
  getEquipmentItems,
  getStockStatus,
  getSupplyItemsByCategory,
  removeInventoryItemImage,
  setInventoryItemPrimaryImage,
  updateInventoryItem,
  uploadInventoryItemImage,
} from "@/lib/inventory/storage";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  ASSET_STATUS_OPTIONS,
  categoryRequiresExpiry,
  categoryRequiresManufactureDate,
  getSupplyCategoryMeta,
  INVENTORY_CATEGORIES,
  type InventoryCategoryId,
  type InventoryItem,
  type InventoryItemInput,
  type ItemKind,
  type StockStatus,
  type SupplyCategoryId,
} from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { InventoryExcelActions } from "@/components/inventory/inventory-excel-actions";
import type { WarehouseModule } from "@/lib/auth/permissions";
import { getReservedQuantities } from "@/lib/holds/storage";
import {
  getInventoryStock,
  hasStockIn,
  placementsFor,
  quantityIn,
  trackingFor,
  type InventoryStock,
} from "@/lib/inventory/tracking";
import { getWarehouses, type Warehouse } from "@/lib/warehouse/stock";
import {
  RelocateStockModal,
  WarehouseManagerModal,
} from "@/components/inventory/warehouse-location-dialogs";
import {
  TrackingDetail,
  TrackingSummary,
  trackingColumnLabel,
  trackingSearchText,
  type TrackingDateMode,
} from "@/components/inventory/inventory-tracking";
import { SortableTable } from "@/components/ui/sortable-table";

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

type ItemImage = { path: string; url: string; primary: boolean };

function itemImages(item: InventoryItem): ItemImage[] {
  const images: ItemImage[] = [];
  if (item.imageUrl) {
    images.push({ path: item.imagePath, url: item.imageUrl, primary: true });
  }
  for (const image of item.galleryImages) {
    images.push({ path: image.path, url: image.url, primary: false });
  }
  return images;
}

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
  /** Tabla propia por categoría, o equipos */
  panelMode?: SupplyCategoryId | "equipment";
};

export function InventoryPanel({ panelMode = "insumos" }: InventoryPanelProps) {
  const isEquipment = panelMode === "equipment";
  const supplyCategory: SupplyCategoryId | null = isEquipment
    ? null
    : panelMode;
  const permissionModule: WarehouseModule = isEquipment
    ? "equipo"
    : (supplyCategory as WarehouseModule);
  const { canWrite, canCreate, canEdit, canDelete, canImport, canExport, role } =
    usePermissions(permissionModule);
  const { session } = useSessionAccess();
  const supplyMeta = supplyCategory
    ? getSupplyCategoryMeta(supplyCategory)
    : null;
  const requiresExpiry = supplyCategory
    ? categoryRequiresExpiry(supplyCategory)
    : false;
  const requiresManufactureDate = isEquipment
    ? true
    : supplyCategory
      ? categoryRequiresManufactureDate(supplyCategory)
      : false;
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [reservedByProduct, setReservedByProduct] = useState<Map<string, number>>(
    new Map()
  );
  const [stockByProduct, setStockByProduct] = useState<Map<string, InventoryStock>>(
    new Map()
  );
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [relocatingItem, setRelocatingItem] = useState<InventoryItem | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const selectedWarehouse = warehouses.find((w) => w.id === warehouseFilter);
  const trackingMode: TrackingDateMode = requiresExpiry
    ? "expiry"
    : requiresManufactureDate
      ? "manufacture"
      : "auto";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formItemKind: ItemKind = isEquipment ? "equipo" : "producto";

  async function handleSubmit(
    data: InventoryItemInput,
    imageFile?: File | null
  ) {
    try {
      setError("");
      const category = isEquipment
        ? "equipos"
        : (supplyCategory ?? data.category);
      const payload: InventoryItemInput = {
        ...data,
        itemKind: formItemKind,
        category,
        tracksExpiry:
          categoryRequiresExpiry(category) &&
          !categoryRequiresManufactureDate(category),
        tracksLot:
          categoryRequiresExpiry(category) || Boolean(data.tracksLot),
        expiryDate: categoryRequiresManufactureDate(category)
          ? ""
          : data.expiryDate,
        manufacturedAt: data.manufacturedAt,
      };
      let savedId = editingItem?.id ?? "";
      if (editingItem) {
        await updateInventoryItem(editingItem.id, payload);
        savedId = editingItem.id;
      } else {
        const session = (await import("@/lib/auth")).getSession();
        const created = await createInventoryItem(
          payload,
          session?.username ?? "sistema"
        );
        savedId = created.id;
      }

      if (imageFile) {
        await uploadInventoryItemImage(savedId, imageFile);
      } else if (imageFile === null && editingItem?.imageUrl) {
        await clearInventoryItemImage(savedId);
      }

      await refreshItems();
      setFormOpen(false);
      setEditingItem(null);
      setViewingItem(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el producto en Supabase."
      );
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const status = getStockStatus(item.quantity, item.minStock);
      const matchesSearch =
        search.trim().length === 0 ||
        [
          item.sku,
          item.name,
          item.brand,
          item.model,
          item.supplier,
          item.serialNumber,
          item.location,
          trackingSearchText(trackingFor(stockByProduct.get(item.id))),
          placementsFor(stockByProduct.get(item.id))
            .map((placement) => placement.locationName)
            .join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        isEquipment ||
        item.itemKind === "equipo" ||
        statusFilter === "all" ||
        status === statusFilter;
      const matchesWarehouse =
        !warehouseFilter || hasStockIn(stockByProduct.get(item.id), warehouseFilter);
      return matchesSearch && matchesStatus && matchesWarehouse;
    });
  }, [items, search, statusFilter, isEquipment, stockByProduct, warehouseFilter]);

  function itemTracking(item: InventoryItem) {
    return trackingFor(stockByProduct.get(item.id), warehouseFilter || undefined);
  }

  function renderPlacements(item: InventoryItem, compact = true) {
    const placements = placementsFor(
      stockByProduct.get(item.id),
      warehouseFilter || undefined
    );
    if (placements.length === 0) {
      return (
        <span className="text-muted-foreground">
          {item.location || "—"}
          {item.location ? (
            <span className="block text-[11px]">Sin existencia registrada</span>
          ) : null}
        </span>
      );
    }
    const shown = compact ? placements.slice(0, 2) : placements;
    const hidden = placements.length - shown.length;
    return (
      <div className="space-y-1 text-xs">
        {shown.map((placement) => (
          <div key={`${placement.warehouseId}-${placement.locationName}`}>
            <p className="text-foreground">
              <span className="font-medium">{placement.warehouseCode}</span>
              {" · "}
              {placement.unplaced && item.location ? item.location : placement.locationName}
              <span className="text-muted-foreground"> · {placement.quantity}</span>
            </p>
            {placement.unplaced ? (
              <p className="text-amber-700 dark:text-amber-300">
                Por ubicar (en {placement.locationName.toLowerCase()})
              </p>
            ) : null}
          </div>
        ))}
        {hidden > 0 ? <p className="text-muted-foreground">+{hidden} más</p> : null}
      </div>
    );
  }

  function openRelocate(item: InventoryItem) {
    setNotice("");
    setRelocatingItem(item);
  }

  function defaultWarehouseFor(item: InventoryItem) {
    if (warehouseFilter) return warehouseFilter;
    const best = placementsFor(stockByProduct.get(item.id)).sort(
      (a, b) => b.quantity - a.quantity
    )[0];
    return best?.warehouseId ?? warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "";
  }

  async function refreshItems() {
    try {
      setLoading(true);
      setError("");
      let trackingError = "";
      const [data, reservedMap, stockMap, warehouseRows] = await Promise.all([
        isEquipment
          ? getEquipmentItems()
          : getSupplyItemsByCategory(supplyCategory ?? "insumos"),
        isEquipment ? Promise.resolve(new Map<string, number>()) : getReservedQuantities(),
        getInventoryStock(isEquipment ? "equipos" : (supplyCategory ?? "insumos")).catch(
          (err: unknown) => {
            trackingError = err instanceof Error ? err.message : String(err);
            return new Map<string, InventoryStock>();
          }
        ),
        getWarehouses().catch(() => [] as Warehouse[]),
      ]);
      setItems(data);
      setReservedByProduct(reservedMap);
      setStockByProduct(stockMap);
      setWarehouses(warehouseRows);
      if (trackingError) {
        setError(`No se pudieron cargar existencias por almacén, lotes y series: ${trackingError}`);
      }
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
  }, [panelMode, isEquipment, supplyCategory]);

  function handleView(item: InventoryItem) {
    setLightboxIndex(null);
    setViewingItem(item);
  }

  function handleEdit(item: InventoryItem) {
    setViewingItem(null);
    setEditingItem(item);
    setFormOpen(true);
  }

  async function runImageAction(
    action: () => Promise<InventoryItem>,
    fallbackMessage: string
  ) {
    try {
      setError("");
      setImageBusy(true);
      const updated = await action();
      setViewingItem(updated);
      await refreshItems();
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMessage);
      return null;
    } finally {
      setImageBusy(false);
    }
  }

  async function handleAddImages(files: File[]) {
    if (!viewingItem || files.length === 0 || !canWrite) return;
    await runImageAction(
      () => addInventoryItemImages(viewingItem.id, files),
      "No se pudieron subir las imágenes."
    );
  }

  async function handleRemoveImage(path: string) {
    if (!viewingItem || !canWrite) return;
    if (!window.confirm("¿Quitar esta imagen del equipo?")) return;
    const updated = await runImageAction(
      () => removeInventoryItemImage(viewingItem.id, path),
      "No se pudo quitar la imagen."
    );
    if (!updated) return;
    const remaining = itemImages(updated).length;
    setLightboxIndex((current) =>
      current == null || remaining === 0 ? null : Math.min(current, remaining - 1)
    );
  }

  async function handleMakePrimary(path: string) {
    if (!viewingItem || !canWrite) return;
    const updated = await runImageAction(
      () => setInventoryItemPrimaryImage(viewingItem.id, path),
      "No se pudo cambiar la imagen principal."
    );
    if (updated) setLightboxIndex((current) => (current == null ? null : 0));
  }

  const viewingImages = viewingItem ? itemImages(viewingItem) : [];

  async function handleDelete(item: InventoryItem) {
    if (!canDelete) return;
    const confirmed = window.confirm(
      `¿Desactivar "${item.name}"? El historial de movimientos se conserva.`
    );
    if (!confirmed) return;
    try {
      setError("");
      const session = (await import("@/lib/auth")).getSession();
      await deleteInventoryItem(item.id, session?.username ?? "sistema");
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

        <ReadOnlyBanner visible={!canWrite} />

        {notice ? (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
          >
            {notice}
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
                  : supplyMeta?.label ?? "Catálogo"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEquipment
                  ? "Activos con número de serie, fecha de fabricación, estado y mantenimiento."
                  : requiresExpiry
                    ? `${supplyMeta?.description ?? ""}. Caducidad y lote obligatorios.`
                    : requiresManufactureDate
                      ? `${supplyMeta?.description ?? ""}. Fecha de fabricación obligatoria; no lleva caducidad.`
                      : `${supplyMeta?.description ?? ""}. Tabla propia sin caducidad obligatoria.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setManagerOpen(true)}>
                <WarehouseIcon className="size-4" />
                Almacenes y ubicaciones
              </Button>
              <InventoryExcelActions
                items={items}
                canWrite={canImport}
                canExport={canExport}
                defaultKind={isEquipment ? "equipo" : "producto"}
                onImported={refreshItems}
                onError={setError}
              />
              {canCreate ? (
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setFormOpen(true);
                  }}
                  className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
                >
                  <Plus className="size-4" />
                  {isEquipment
                    ? "Nuevo equipo"
                    : `Nuevo ${supplyMeta?.label.toLowerCase() ?? "artículo"}`}
                </Button>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              "grid gap-3 border-b border-border p-4",
              isEquipment ? "md:grid-cols-[1fr_auto]" : "md:grid-cols-[1fr_auto_auto]"
            )}
          >
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={
                  isEquipment
                    ? "Buscar por SKU, nombre, marca, proveedor o serie..."
                    : "Buscar por SKU, nombre, marca, proveedor, lote o serie..."
                }
                className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
              />
            </label>
            <select
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
              aria-label="Almacén"
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              <option value="">Todos los almacenes</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                  {warehouse.city ? ` · ${warehouse.city}` : ""}
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
            ) : null}
          </div>

          <ResponsiveDataList
            emptyMessage={
              isEquipment
                ? "No hay equipos que coincidan con los filtros."
                : `No hay ${supplyMeta?.label.toLowerCase() ?? "artículos"} que coincidan con los filtros.`
            }
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
                        : (() => {
                            if (selectedWarehouse) {
                              return `${quantityIn(stockByProduct.get(item.id), selectedWarehouse.id)} ${item.unit} en ${selectedWarehouse.code} · total ${item.quantity}`;
                            }
                            const reserved = reservedByProduct.get(item.id) ?? 0;
                            const available = Math.max(0, item.quantity - reserved);
                            return reserved > 0
                              ? `${item.quantity} ${item.unit} · disp. ${available} · apr. ${reserved}`
                              : `${item.quantity} ${item.unit} (mín. ${item.minStock})`;
                          })(),
                  },
                  ...(!isEquipment
                    ? [
                        {
                          label: trackingColumnLabel(trackingMode),
                          value: (
                            <TrackingSummary
                              item={item}
                              tracking={itemTracking(item)}
                              mode={trackingMode}
                            />
                          ),
                        },
                      ]
                    : []),
                  { label: "Almacén / ubicación", value: renderPlacements(item) },
                  {
                    label: requiresManufactureDate
                      ? "Fabricación"
                      : "Precio",
                    value: requiresManufactureDate
                      ? item.manufacturedAt || "—"
                      : formatCurrency(item.unitPrice),
                  },
                  ...(requiresManufactureDate
                    ? [{ label: "Precio", value: formatCurrency(item.unitPrice) }]
                    : []),
                ],
                actions: (
                  <>
                    <button
                      type="button"
                      onClick={() => handleView(item)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                    >
                      <Eye className="size-3.5" />
                      Ficha
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => openRelocate(item)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        <MapPin className="size-3.5" />
                        Ubicar
                      </button>
                    ) : null}
                    {canWrite ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            Desactivar
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ),
              };
            })}
          />

          <DesktopTable>
            <SortableTable className="min-w-full text-sm">
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
                    <th className="px-4 py-3 font-medium">
                      {trackingColumnLabel(trackingMode)}
                    </th>
                  ) : null}
                  {!isEquipment ? (
                    <th className="px-4 py-3 font-medium">Alerta</th>
                  ) : (
                    <th className="px-4 py-3 font-medium">Próx. mant.</th>
                  )}
                  <th className="px-4 py-3 font-medium">Almacén / ubicación</th>
                  {requiresManufactureDate ? (
                    <th className="px-4 py-3 font-medium">Fabricación</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8 + (requiresManufactureDate ? 1 : 0) + (isEquipment ? 0 : 1)}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      {isEquipment
                        ? "No hay equipos que coincidan con los filtros."
                        : `No hay ${supplyMeta?.label.toLowerCase() ?? "artículos"} que coincidan con los filtros.`}
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
                              {selectedWarehouse
                                ? quantityIn(stockByProduct.get(item.id), selectedWarehouse.id)
                                : item.quantity}{" "}
                              {item.unit}
                              <p className="text-xs text-muted-foreground">
                                {(() => {
                                  if (selectedWarehouse) {
                                    return `en ${selectedWarehouse.code} · total ${item.quantity}`;
                                  }
                                  const reserved =
                                    reservedByProduct.get(item.id) ?? 0;
                                  const available = Math.max(
                                    0,
                                    item.quantity - reserved
                                  );
                                  return reserved > 0
                                    ? `disp. ${available} · apr. ${reserved}`
                                    : `mín. ${item.minStock}`;
                                })()}
                              </p>
                            </>
                          )}
                        </td>
                        {!isEquipment ? (
                          <td className="px-4 py-3 align-top">
                            <TrackingSummary
                              item={item}
                              tracking={itemTracking(item)}
                              mode={trackingMode}
                            />
                          </td>
                        ) : null}
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
                        <td className="px-4 py-3 align-top">{renderPlacements(item)}</td>
                        {requiresManufactureDate ? (
                          <td className="px-4 py-3 text-muted-foreground">
                            {item.manufacturedAt || "—"}
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleView(item)}
                              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Ver ficha ${item.name}`}
                            >
                              <Eye className="size-4" />
                            </button>
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => openRelocate(item)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Ubicar ${item.name}`}
                                title="Ubicar en almacén"
                              >
                                <MapPin className="size-4" />
                              </button>
                            ) : null}
                            {canWrite ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label={`Editar ${item.name}`}
                                >
                                  <Pencil className="size-4" />
                                </button>
                                {canDelete ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(item)}
                                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`Eliminar ${item.name}`}
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </SortableTable>
          </DesktopTable>
        </section>
      </div>

      {formOpen && canWrite ? (
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
                    : `Editar ${supplyMeta?.label.toLowerCase() ?? "artículo"}`
                  : isEquipment
                    ? "Nuevo equipo médico"
                    : `Nuevo ${supplyMeta?.label.toLowerCase() ?? "artículo"}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isEquipment
                  ? "Los equipos se gestionan como activos. La fecha de fabricación es obligatoria."
                  : requiresExpiry
                    ? "Esta tabla exige control de caducidad y lote en entradas."
                    : requiresManufactureDate
                      ? "Los accesorios llevan fecha de fabricación y no caducan."
                      : "Tabla propia de refacciones/accesorios sin caducidad obligatoria."}
              </p>
            </div>
            <InventoryForm
              item={editingItem}
              itemKind={formItemKind}
              lockedCategory={supplyCategory ?? undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setFormOpen(false);
                setEditingItem(null);
              }}
            />
          </div>
        </div>
      ) : null}

      {viewingItem ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Ficha de consulta
                </p>
                <h3 className="text-lg font-semibold">{viewingItem.name}</h3>
                <p className="font-mono text-sm text-muted-foreground">
                  {viewingItem.sku}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const item = viewingItem;
                      setViewingItem(null);
                      openRelocate(item);
                    }}
                  >
                    <MapPin className="size-4" /> Ubicar
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button
                    type="button"
                    onClick={() => handleEdit(viewingItem)}
                    className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  >
                    <Pencil className="size-4" /> Editar datos
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLightboxIndex(null);
                    setViewingItem(null);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            </div>

            <div className="mb-4 grid gap-4 sm:grid-cols-[200px_1fr]">
              <div className="space-y-2">
                {viewingImages[0] ? (
                  <button
                    type="button"
                    className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted/30"
                    onClick={() => setLightboxIndex(0)}
                    aria-label="Ampliar imagen principal"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewingImages[0].url}
                      alt={viewingItem.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                      <ZoomIn className="size-7" />
                    </span>
                    <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                      Principal
                    </span>
                  </button>
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
                    <span className="px-3 text-center text-xs text-muted-foreground">
                      Sin imágenes
                    </span>
                  </div>
                )}

                {viewingImages.length > 1 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {viewingImages.slice(1).map((image, i) => (
                      <button
                        key={image.path}
                        type="button"
                        className="aspect-square overflow-hidden rounded-lg border border-border hover:opacity-85"
                        onClick={() => setLightboxIndex(i + 1)}
                        aria-label={`Ampliar imagen ${i + 2}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  {viewingImages.length === 0
                    ? "Aún no hay fotos del equipo."
                    : `${viewingImages.length} ${viewingImages.length === 1 ? "imagen" : "imágenes"} · clic para ampliar`}
                </p>

                {canWrite ? (
                  <label
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted",
                      imageBusy && "pointer-events-none opacity-60"
                    )}
                  >
                    {imageBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ImagePlus className="size-4" />
                    )}
                    {imageBusy ? "Guardando…" : "Agregar imágenes"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      disabled={imageBusy}
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = "";
                        void handleAddImages(files);
                      }}
                    />
                  </label>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Categoría", getCategoryLabel(viewingItem.category)],
                  ["Marca", viewingItem.brand || "—"],
                  ["Modelo", viewingItem.model || "—"],
                  [
                    isEquipment || viewingItem.tracksSerial ? "Serie" : "Serie / lote",
                    viewingItem.serialNumber || "—",
                  ],
                  [
                    "Almacén / ubicación",
                    placementsFor(stockByProduct.get(viewingItem.id))
                      .map(
                        (placement) =>
                          `${placement.warehouseCode} · ${
                            placement.unplaced && viewingItem.location
                              ? `${viewingItem.location} (por ubicar)`
                              : placement.locationName
                          } · ${placement.quantity}`
                      )
                      .join(" | ") ||
                      viewingItem.location ||
                      "—",
                  ],
                  ["Proveedor", viewingItem.supplier || "—"],
                  ["Precio", formatCurrency(viewingItem.unitPrice)],
                  [
                    "Stock",
                    `${viewingItem.quantity} ${viewingItem.unit}`,
                  ],
                  [
                    "Estado activo",
                    ASSET_STATUS_OPTIONS.find(
                      (s) => s.id === viewingItem.assetStatus
                    )?.label ?? viewingItem.assetStatus,
                  ],
                  ["Fabricación", viewingItem.manufacturedAt || "—"],
                  ...(trackingMode === "manufacture"
                    ? []
                    : [
                        [
                          trackingMode === "expiry" ? "Próxima caducidad" : "Caducidad",
                          viewingItem.expiryDate ||
                            trackingFor(stockByProduct.get(viewingItem.id))?.lots.find(
                              (lot) => lot.expiryDate
                            )?.expiryDate ||
                            "—",
                        ],
                      ]),
                  ["Próx. mant.", viewingItem.nextMaintenanceDate || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                {isEquipment ? "Números de serie" : "Lotes, series y caducidad"}
              </p>
              <TrackingDetail
                item={viewingItem}
                tracking={trackingFor(stockByProduct.get(viewingItem.id))}
                mode={trackingMode}
              />
            </div>

            {viewingItem.description ? (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground">Descripción</p>
                <p className="text-sm whitespace-pre-wrap">
                  {viewingItem.description}
                </p>
              </div>
            ) : null}
            {viewingItem.notes ? (
              <div>
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-sm whitespace-pre-wrap">{viewingItem.notes}</p>
              </div>
            ) : null}
            <p className="mt-4 text-xs text-muted-foreground">
              Esta ficha es de solo lectura. Usa &quot;Editar datos&quot; para
              modificar el registro.
            </p>
          </div>
        </div>
      ) : null}

      {viewingItem && lightboxIndex != null && viewingImages[lightboxIndex] ? (
        <ImageLightbox
          images={viewingImages.map((image, i) => ({
            src: image.url,
            alt: viewingItem.name,
            caption: `${viewingItem.name}${image.primary ? " · Principal" : ` · Imagen ${i + 1}`}`,
          }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          renderActions={
            canWrite
              ? (index) => {
                  const image = viewingImages[index];
                  if (!image) return null;
                  return (
                    <>
                      {!image.primary ? (
                        <button
                          type="button"
                          disabled={imageBusy}
                          onClick={() => void handleMakePrimary(image.path)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-50"
                        >
                          <Star className="size-3.5" /> Hacer principal
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={imageBusy}
                        onClick={() => void handleRemoveImage(image.path)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" /> Quitar imagen
                      </button>
                    </>
                  );
                }
              : undefined
          }
        />
      ) : null}

      {relocatingItem && canEdit ? (
        <RelocateStockModal
          item={relocatingItem}
          stock={stockByProduct.get(relocatingItem.id)}
          warehouses={warehouses}
          initialWarehouseId={defaultWarehouseFor(relocatingItem)}
          actor={session?.username ?? "sistema"}
          onClose={() => setRelocatingItem(null)}
          onDone={(result, warehouse) => {
            const name = relocatingItem.name;
            setRelocatingItem(null);
            setNotice(
              result.movedQty > 0
                ? `${name}: ${result.movedQty} ${relocatingItem.unit} ubicados en ${warehouse.code} · ${result.locationName} (folio ${result.folio}).`
                : `${name}: ubicación asignada ${warehouse.code} · ${result.locationName}.`
            );
            void refreshItems();
          }}
        />
      ) : null}

      {managerOpen ? (
        <WarehouseManagerModal
          canEditLocations={canEdit}
          canManageWarehouses={role === "administrador"}
          onClose={() => setManagerOpen(false)}
          onChanged={() => void refreshItems()}
        />
      ) : null}
    </>
  );
}
