"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  Eye,
  ImagePlus,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  Warehouse as WarehouseIcon,
  X,
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
  getInventoryItems,
  getStockStatus,
  getSupplyItemsByCategory,
  removeInventoryItemImage,
  setInventoryItemColor,
  setInventoryItemPrimaryImage,
  setInventoryStockAlertsEnabled,
  updateInventoryItem,
  uploadInventoryItemImage,
} from "@/lib/inventory/storage";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  ASSET_STATUS_OPTIONS,
  CATALOG_CATEGORIES,
  getSupplyCategoryMeta,
  INVENTORY_CATEGORIES,
  type CatalogCategoryId,
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
import {
  INVENTORY_TAB_MODULES,
  inventoryModuleForCategory,
  permissionKey,
  type PermissionAction,
  type WarehouseModule,
} from "@/lib/auth/permissions";
import { getReservedQuantities } from "@/lib/holds/storage";
import {
  getInventoryStock,
  hasStockIn,
  placementsFor,
  quantityIn,
  trackingFor,
  type InventoryLotStock,
  type InventorySerial,
  type InventoryStock,
} from "@/lib/inventory/tracking";
import { LotUnitDialog, SerialUnitDialog } from "@/components/inventory/unit-dialogs";
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
import { SearchInput } from "@/components/ui/search-input";
import { normalizeBrand, uniqueBrands } from "@/lib/inventory/brands";
import { matchesSearch } from "@/lib/search";
import {
  PRODUCT_COLORS,
  productColorLabel,
  productColorMeta,
  resolveProductColor,
} from "@/lib/inventory/colors";

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

function ProductThumb({
  item,
  className,
}: {
  item: InventoryItem;
  className?: string;
}) {
  if (!item.imageUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.imageUrl}
      alt=""
      className={cn(
        "shrink-0 rounded-lg border border-border bg-muted object-cover",
        className
      )}
    />
  );
}

function brandWithPartNumber(item: InventoryItem) {
  return [item.brand, item.partNumber ? `n.º ${item.partNumber}` : "", item.model]
    .filter(Boolean)
    .join(" · ");
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

function stockBadgeLabel(item: InventoryItem) {
  const status = getStockStatus(item.quantity, item.minStock);
  if (item.itemKind === "equipo") return STATUS_LABELS[status];
  if (item.stockAlertsEnabled === false) {
    return `${STATUS_LABELS[status]} · sin alerta`;
  }
  return STATUS_LABELS[status];
}

type InventoryPanelProps = {
  /** Catálogo unificado, una categoría, o solo equipos */
  panelMode?: SupplyCategoryId | "equipment" | "catalog";
  initialCategory?: CatalogCategoryId | null;
};

export function InventoryPanel({
  panelMode = "catalog",
  initialCategory = null,
}: InventoryPanelProps) {
  const isCatalog = panelMode === "catalog";
  const isEquipment = panelMode === "equipment";
  const supplyCategory: SupplyCategoryId | null =
    isCatalog || isEquipment ? null : panelMode;
  const permissionModule: WarehouseModule = isEquipment
    ? "equipo"
    : (supplyCategory as WarehouseModule) ?? "insumos";
  const scoped = usePermissions(permissionModule);
  const access = useSessionAccess();
  const { session } = access;
  const supplyMeta = supplyCategory
    ? getSupplyCategoryMeta(supplyCategory)
    : null;
  const [categoryFilter, setCategoryFilter] = useState<
    CatalogCategoryId | "all"
  >(initialCategory ?? "all");
  const [brandFilter, setBrandFilter] = useState("todas");
  const [colorFilter, setColorFilter] = useState("todos");

  function catalogCan(action: PermissionAction) {
    return INVENTORY_TAB_MODULES.some(
      (module) => !access.ready || access.can(permissionKey(module, action))
    );
  }

  function itemCan(item: InventoryItem, action: PermissionAction) {
    if (!isCatalog) return scoped.can(action);
    return (
      !access.ready ||
      access.can(permissionKey(inventoryModuleForCategory(item.category), action))
    );
  }

  const canCreate = isCatalog ? catalogCan("create") : scoped.canCreate;
  const canEdit = isCatalog ? catalogCan("edit") : scoped.canEdit;
  const canDelete = isCatalog ? catalogCan("delete") : scoped.canDelete;
  const canImport = isCatalog ? catalogCan("import") : scoped.canImport;
  const canExport = isCatalog ? catalogCan("export") : scoped.canExport;
  const canWrite = canCreate || canEdit || canDelete;
  const canViewPrices = !access.ready || access.can("precios.view");
  const canEditPrices = !access.ready || access.can("precios.edit");
  const role = scoped.role;
  const visibleCategories = CATALOG_CATEGORIES.filter(
    (entry) =>
      !access.ready ||
      access.canView(inventoryModuleForCategory(entry.id))
  );
  const creatableCategories = CATALOG_CATEGORIES.filter(
    (entry) =>
      !access.ready ||
      access.can(
        permissionKey(inventoryModuleForCategory(entry.id), "create")
      )
  ).map((entry) => entry.id);
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
  const trackingMode: TrackingDateMode = isEquipment ? "manufacture" : "both";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    StockStatus | "all" | "sin_alerta"
  >("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [openSerial, setOpenSerial] = useState<InventorySerial | null>(null);
  const [openLot, setOpenLot] = useState<InventoryLotStock | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formItemKind: ItemKind = isEquipment
    ? "equipo"
    : editingItem?.itemKind ?? "producto";

  useEffect(() => {
    setCategoryFilter(initialCategory ?? "all");
  }, [initialCategory]);

  async function handleSubmit(
    data: InventoryItemInput,
    imageFile?: File | null
  ) {
    try {
      setError("");
      setNotice("");
      const category = isEquipment
        ? "equipos"
        : isCatalog
          ? data.category
          : (supplyCategory ?? data.category);
      const itemKind =
        category === "equipos" || data.itemKind === "equipo"
          ? "equipo"
          : "producto";
      const payload: InventoryItemInput = {
        ...data,
        itemKind,
        category,
        colorTag: data.colorTag || "",
        expiryDate: itemKind === "equipo" ? "" : data.expiryDate,
        manufacturedAt: data.manufacturedAt,
        unitPrice: canEditPrices
          ? data.unitPrice
          : editingItem?.unitPrice ?? 0,
        costPrice: canEditPrices
          ? data.costPrice
          : editingItem?.costPrice ?? 0,
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
        try {
          await uploadInventoryItemImage(savedId, imageFile);
        } catch (photoError) {
          setNotice(
            photoError instanceof Error
              ? `El producto se guardó, pero la foto no se subió: ${photoError.message}`
              : "El producto se guardó, pero la foto no se subió."
          );
        }
      } else if (imageFile === null && editingItem?.imageUrl) {
        try {
          await clearInventoryItemImage(savedId);
        } catch (photoError) {
          setNotice(
            photoError instanceof Error
              ? `El producto se guardó, pero no se pudo quitar la foto: ${photoError.message}`
              : "El producto se guardó, pero no se pudo quitar la foto."
          );
        }
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
      const matchesCategory =
        !isCatalog ||
        categoryFilter === "all" ||
        item.category === categoryFilter;
      const matchesQuery = matchesSearch(search, [
        item.sku,
        item.name,
        item.brand,
        productColorLabel(resolveProductColor(item.colorTag, item.brand)),
        item.partNumber,
        item.model,
        item.supplier,
        item.serialNumber,
        item.location,
        item.category,
        item.subcategory,
        item.description,
        item.notes,
        getCategoryLabel(item.category),
        trackingSearchText(trackingFor(stockByProduct.get(item.id))),
        placementsFor(stockByProduct.get(item.id))
          .map((placement) => placement.locationName)
          .join(" "),
      ]);
      const matchesStatus =
        isEquipment ||
        item.itemKind === "equipo" ||
        statusFilter === "all" ||
        (statusFilter === "sin_alerta"
          ? item.stockAlertsEnabled === false
          : status === statusFilter);
      const matchesWarehouse =
        !warehouseFilter || hasStockIn(stockByProduct.get(item.id), warehouseFilter);
      const matchesBrand =
        brandFilter === "todas" ||
        (brandFilter === "sin_marca"
          ? !normalizeBrand(item.brand)
          : normalizeBrand(item.brand).toLowerCase() ===
            brandFilter.toLowerCase());
      const itemColor = resolveProductColor(item.colorTag, item.brand);
      const matchesColor =
        colorFilter === "todos" ||
        (colorFilter === "sin_color" ? !itemColor : itemColor === colorFilter);
      return (
        matchesCategory &&
        matchesQuery &&
        matchesStatus &&
        matchesWarehouse &&
        matchesBrand &&
        matchesColor
      );
    });
  }, [
    items,
    search,
    statusFilter,
    isEquipment,
    isCatalog,
    categoryFilter,
    stockByProduct,
    warehouseFilter,
    brandFilter,
    colorFilter,
  ]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    (isCatalog && categoryFilter !== "all") ||
    brandFilter !== "todas" ||
    colorFilter !== "todos" ||
    statusFilter !== "all" ||
    Boolean(warehouseFilter);

  function clearInventoryFilters() {
    setSearch("");
    setCategoryFilter("all");
    setBrandFilter("todas");
    setColorFilter("todos");
    setStatusFilter("all");
    setWarehouseFilter("");
  }

  const catalogBrands = useMemo(
    () => uniqueBrands(items.map((item) => item.brand)),
    [items]
  );

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

  async function handleClearColor(item: InventoryItem) {
    if (!itemCan(item, "edit")) return;
    try {
      setError("");
      const saved = await setInventoryItemColor(item.id, "");
      setItems((current) =>
        current.map((row) => (row.id === saved.id ? { ...row, colorTag: "" } : row))
      );
      setViewingItem((current) =>
        current?.id === saved.id ? { ...current, colorTag: "" } : current
      );
      setEditingItem((current) =>
        current?.id === saved.id ? { ...current, colorTag: "" } : current
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo quitar el color del producto."
      );
    }
  }

  function renderColorTag(item: InventoryItem) {
    const colorId = resolveProductColor(item.colorTag);
    const color = productColorMeta(colorId);
    if (!color) {
      return <span className="text-xs text-muted-foreground">Sin color</span>;
    }
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          color.chip
        )}
      >
        <span className={cn("size-2.5 rounded-full", color.swatch)} />
        {color.label}
        {itemCan(item, "edit") ? (
          <button
            type="button"
            title="Quitar color"
            aria-label={`Quitar color de ${item.name}`}
            onClick={(event) => {
              event.stopPropagation();
              void handleClearColor(item);
            }}
            className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-current/70 hover:bg-black/10 hover:text-current dark:hover:bg-white/15"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </span>
    );
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
        isCatalog
          ? getInventoryItems()
          : isEquipment
            ? getEquipmentItems()
            : getSupplyItemsByCategory(supplyCategory ?? "insumos"),
        isEquipment && !isCatalog
          ? Promise.resolve(new Map<string, number>())
          : getReservedQuantities(),
        getInventoryStock(
          isCatalog
            ? undefined
            : isEquipment
              ? "equipos"
              : (supplyCategory ?? "insumos")
        ).catch((err: unknown) => {
          trackingError = err instanceof Error ? err.message : String(err);
          return new Map<string, InventoryStock>();
        }),
        getWarehouses().catch(() => [] as Warehouse[]),
      ]);
      const visible = isCatalog
        ? data.filter(
            (item) =>
              !access.ready ||
              access.canView(inventoryModuleForCategory(item.category))
          )
        : data;
      setItems(visible);
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
  }, [panelMode, isEquipment, isCatalog, supplyCategory]);

  function handleView(item: InventoryItem) {
    setLightboxIndex(null);
    setOpenSerial(null);
    setOpenLot(null);
    setViewingItem(item);
  }

  function handleEdit(item: InventoryItem) {
    setViewingItem(null);
    setEditingItem(item);
    setFormOpen(true);
  }

  async function handleToggleAlerts(item: InventoryItem) {
    try {
      setError("");
      const saved = await setInventoryStockAlertsEnabled(
        item.id,
        item.stockAlertsEnabled === false
      );
      setItems((rows) =>
        rows.map((row) => (row.id === saved.id ? saved : row))
      );
      if (viewingItem?.id === saved.id) setViewingItem(saved);
      setNotice(
        saved.stockAlertsEnabled
          ? `Se reactivó la alerta de stock de ${saved.sku}.`
          : `Se silenció la alerta de agotado de ${saved.sku}. El código sigue en el catálogo.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la alerta de stock."
      );
    }
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
    if (!viewingItem || files.length === 0 || !itemCan(viewingItem, "edit")) return;
    await runImageAction(
      () => addInventoryItemImages(viewingItem.id, files),
      "No se pudieron subir las imágenes."
    );
  }

  async function handleRemoveImage(path: string) {
    if (!viewingItem || !itemCan(viewingItem, "edit")) return;
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
    if (!viewingItem || !itemCan(viewingItem, "edit")) return;
    const updated = await runImageAction(
      () => setInventoryItemPrimaryImage(viewingItem.id, path),
      "No se pudo cambiar la imagen principal."
    );
    if (updated) setLightboxIndex((current) => (current == null ? null : 0));
  }

  const viewingImages = viewingItem ? itemImages(viewingItem) : [];

  async function handleDelete(item: InventoryItem) {
    if (!itemCan(item, "delete")) return;
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
                {isCatalog
                  ? "Inventario"
                  : isEquipment
                    ? "Equipos médicos"
                    : supplyMeta?.label ?? "Catálogo"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isCatalog
                  ? "Una sola lista para insumos, medicamentos, refacciones, accesorios, reactivos y equipos. Filtra por categoría si lo necesitas."
                  : isEquipment
                    ? "Catálogo por modelo. Las series de cada pieza se registran al dar entrada."
                    : `${supplyMeta?.description ?? "Catálogo"}. El número de parte se muestra junto a la marca.`}
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
                canViewPrices={canViewPrices}
                canEditPrices={canEditPrices}
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
                  {isCatalog
                    ? "Nuevo artículo"
                    : isEquipment
                      ? "Nuevo equipo"
                      : `Nuevo ${supplyMeta?.label.toLowerCase() ?? "artículo"}`}
                </Button>
              ) : null}
            </div>
          </div>

          {isCatalog && visibleCategories.length > 1 ? (
            <div
              className="flex flex-wrap gap-1 border-b border-border bg-muted/20 p-3"
              role="tablist"
              aria-label="Filtrar por categoría"
            >
              <button
                type="button"
                role="tab"
                aria-selected={categoryFilter === "all"}
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  categoryFilter === "all"
                    ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Todas
              </button>
              {visibleCategories.map((entry) => {
                const active = categoryFilter === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() =>
                      setCategoryFilter(active ? "all" : entry.id)
                    }
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium",
                      active
                        ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {catalogBrands.length > 0 ? (
            <div className="space-y-2 border-b border-border bg-muted/10 px-3 py-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Marcas rápidas
              </p>
              <div
                className="flex flex-wrap gap-1"
                role="tablist"
                aria-label="Filtrar por marca"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={brandFilter === "todas"}
                  onClick={() => setBrandFilter("todas")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    brandFilter === "todas"
                      ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-sm"
                      : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Todas
                </button>
                {catalogBrands.map((brand) => {
                  const active = brandFilter === brand;
                  return (
                    <button
                      key={brand}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() =>
                        setBrandFilter(active ? "todas" : brand)
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        active
                          ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-sm"
                          : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {brand}
                    </button>
                  );
                })}
                {items.some((item) => !item.brand.trim()) ? (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={brandFilter === "sin_marca"}
                    onClick={() =>
                      setBrandFilter(
                        brandFilter === "sin_marca" ? "todas" : "sin_marca"
                      )
                    }
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      brandFilter === "sin_marca"
                        ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-sm"
                        : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    Sin marca
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 border-b border-border px-3 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Colores para separar
            </p>
            <div
              className="flex flex-wrap gap-1"
              role="tablist"
              aria-label="Filtrar por color"
            >
              <button
                type="button"
                role="tab"
                aria-selected={colorFilter === "todos"}
                onClick={() => setColorFilter("todos")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  colorFilter === "todos"
                    ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-sm"
                    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Todos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={colorFilter === "sin_color"}
                onClick={() =>
                  setColorFilter(
                    colorFilter === "sin_color" ? "todos" : "sin_color"
                  )
                }
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  colorFilter === "sin_color"
                    ? "bg-muted text-foreground ring-1 ring-foreground/20"
                    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                Sin color
              </button>
              {PRODUCT_COLORS.map((color) => {
                const active = colorFilter === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() =>
                      setColorFilter(active ? "todos" : color.id)
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                      active
                        ? cn(color.chip, "ring-1 ring-foreground/20")
                        : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full", color.swatch)} />
                    {color.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 border-b border-border p-4">
            <div
              className={cn(
                "grid gap-3",
                isEquipment
                  ? "md:grid-cols-[1fr_auto]"
                  : "md:grid-cols-[1fr_auto_auto]"
              )}
            >
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={
                  isCatalog
                    ? "Buscar por código, nombre, n.º de parte, marca o modelo..."
                    : isEquipment
                      ? "Buscar por SKU, nombre, marca, proveedor o serie..."
                      : "Buscar por SKU, nombre, marca, proveedor, lote o serie..."
                }
                ariaLabel="Buscar en el inventario"
              />
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
                    setStatusFilter(
                      event.target.value as StockStatus | "all" | "sin_alerta"
                    )
                  }
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="disponible">Disponible</option>
                  <option value="bajo_stock">Bajo stock</option>
                  <option value="agotado">Agotado</option>
                  <option value="sin_alerta">Alerta desactivada</option>
                </select>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Cargando catálogo…"
                  : filteredItems.length === items.length
                    ? `${items.length} artículo${items.length === 1 ? "" : "s"}`
                    : `${filteredItems.length} de ${items.length} artículos`}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearInventoryFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                  Quitar filtros
                </button>
              ) : null}
            </div>
          </div>

          <ResponsiveDataList
            emptyMessage={
              hasActiveFilters
                ? "Ningún artículo coincide con la búsqueda o los filtros. Prueba quitar filtros o buscar por SKU o n.º de parte."
                : isCatalog
                  ? "No hay artículos en el catálogo."
                  : isEquipment
                    ? "No hay equipos registrados."
                    : `No hay ${supplyMeta?.label.toLowerCase() ?? "artículos"} registrados.`
            }
            items={filteredItems.map((item) => {
              const status = getStockStatus(item.quantity, item.minStock);
              return {
                key: item.id,
                title: (
                  <span className="flex items-center gap-2">
                    <ProductThumb item={item} className="size-11" />
                    <span className="min-w-0 truncate">{item.name}</span>
                  </span>
                ),
                subtitle: `${item.sku} · ${brandWithPartNumber(item) || "Sin marca"}`,
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
                        item.stockAlertsEnabled === false
                          ? "bg-muted text-muted-foreground"
                          : STATUS_STYLES[status]
                      )}
                    >
                      {stockBadgeLabel(item)}
                    </span>
                  ),
                fields: [
                  {
                    label: "Color",
                    value: renderColorTag(item),
                  },
                  {
                    label: "Marca",
                    value: item.brand || "Sin marca",
                  },
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
                  ...(canViewPrices
                    ? [
                        {
                          label: "Costo",
                          value: formatCurrency(item.costPrice),
                        },
                        {
                          label: "Venta",
                          value:
                            item.unitPrice > 0
                              ? formatCurrency(item.unitPrice)
                              : "Pendiente",
                        },
                      ]
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
                    {itemCan(item, "edit") && item.itemKind !== "equipo" ? (
                      <button
                        type="button"
                        onClick={() => void handleToggleAlerts(item)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        {item.stockAlertsEnabled === false ? (
                          <Bell className="size-3.5" />
                        ) : (
                          <BellOff className="size-3.5" />
                        )}
                        {item.stockAlertsEnabled === false
                          ? "Activar alerta"
                          : "Silenciar alerta"}
                      </button>
                    ) : null}
                    {itemCan(item, "edit") ? (
                      <button
                        type="button"
                        onClick={() => openRelocate(item)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        <MapPin className="size-3.5" />
                        Ubicar
                      </button>
                    ) : null}
                    {itemCan(item, "edit") ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </button>
                        {itemCan(item, "delete") ? (
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
                  <th className="px-4 py-3 font-medium">Foto</th>
                  <th className="px-4 py-3 font-medium">Color</th>
                  <th className="px-4 py-3 font-medium">
                    {isCatalog ? "Artículo" : isEquipment ? "Equipo" : "Producto"}
                  </th>
                  <th className="px-4 py-3 font-medium">Marca</th>
                  <th className="px-4 py-3 font-medium">
                    {isEquipment && !isCatalog ? "Serie" : "Categoría"}
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
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isEquipment ? 10 : 11}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      {hasActiveFilters
                        ? "Ningún artículo coincide con la búsqueda o los filtros. Prueba quitar filtros o buscar por SKU o n.º de parte."
                        : isCatalog
                          ? "No hay artículos en el catálogo."
                          : isEquipment
                            ? "No hay equipos registrados."
                            : `No hay ${supplyMeta?.label.toLowerCase() ?? "artículos"} registrados.`}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const status = getStockStatus(item.quantity, item.minStock);
                    const colorId = resolveProductColor(item.colorTag, item.brand);
                    const color = productColorMeta(colorId);
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "border-t border-border/70 hover:bg-muted/30",
                          color?.bar && `border-l-4 ${color.bar}`
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {item.sku}
                        </td>
                        <td className="px-4 py-3">
                          {item.imageUrl ? (
                            <ProductThumb item={item} className="size-12" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{renderColorTag(item)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.partNumber
                              ? `n.º ${item.partNumber}${item.model ? ` · ${item.model}` : ""}`
                              : item.model || "—"}
                          </p>
                          {canViewPrices ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Costo {formatCurrency(item.costPrice)}
                              {" · "}
                              Venta{" "}
                              {item.unitPrice > 0
                                ? formatCurrency(item.unitPrice)
                                : "pendiente"}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {item.brand ? (
                            <span className="inline-flex rounded-full bg-[#3B46A5]/10 px-2.5 py-1 text-xs font-medium text-[#3B46A5]">
                              {item.brand}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin marca</span>
                          )}
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
                                item.stockAlertsEnabled === false
                                  ? "bg-muted text-muted-foreground"
                                  : STATUS_STYLES[status]
                              )}
                            >
                              {stockBadgeLabel(item)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">{renderPlacements(item)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleView(item)}
                              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label={`Ver ficha ${item.name}`}
                            >
                              <Eye className="size-4" />
                            </button>
                            {itemCan(item, "edit") ? (
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
                            {itemCan(item, "edit") && item.itemKind !== "equipo" ? (
                              <button
                                type="button"
                                onClick={() => void handleToggleAlerts(item)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={
                                  item.stockAlertsEnabled === false
                                    ? `Activar alerta de ${item.name}`
                                    : `Silenciar alerta de ${item.name}`
                                }
                                title={
                                  item.stockAlertsEnabled === false
                                    ? "Activar alerta de agotado"
                                    : "Silenciar alerta de agotado"
                                }
                              >
                                {item.stockAlertsEnabled === false ? (
                                  <BellOff className="size-4" />
                                ) : (
                                  <Bell className="size-4" />
                                )}
                              </button>
                            ) : null}
                            {itemCan(item, "edit") ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                  aria-label={`Editar ${item.name}`}
                                >
                                  <Pencil className="size-4" />
                                </button>
                                {itemCan(item, "delete") ? (
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
                  ? isCatalog
                    ? editingItem.itemKind === "equipo"
                      ? "Editar equipo"
                      : "Editar artículo"
                    : isEquipment
                      ? "Editar equipo"
                      : `Editar ${supplyMeta?.label.toLowerCase() ?? "artículo"}`
                  : isCatalog
                    ? "Nuevo artículo"
                    : isEquipment
                      ? "Nuevo equipo médico"
                      : `Nuevo ${supplyMeta?.label.toLowerCase() ?? "artículo"}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isCatalog
                  ? "Elige la categoría. En equipos el catálogo es por modelo; las series se capturan al dar entrada."
                  : isEquipment
                    ? "Los equipos se gestionan como activos. La fecha de fabricación es opcional."
                    : "La caducidad y la fecha de fabricación son opcionales. El número de parte queda junto a la marca."}
              </p>
            </div>
            <InventoryForm
              item={editingItem}
              itemKind={
                isCatalog
                  ? editingItem?.itemKind === "equipo"
                    ? "equipo"
                    : "producto"
                  : formItemKind
              }
              lockedCategory={
                isCatalog
                  ? editingItem && editingItem.itemKind !== "equipo"
                    ? (editingItem.category as SupplyCategoryId)
                    : undefined
                  : (supplyCategory ?? undefined)
              }
              allowedCategories={isCatalog ? creatableCategories : undefined}
              quickBrands={catalogBrands}
              canViewPrices={canViewPrices}
              canEditPrices={canEditPrices}
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
                {itemCan(viewingItem, "edit") ? (
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
                {itemCan(viewingItem, "edit") ? (
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
                    setOpenSerial(null);
                    setOpenLot(null);
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

                {itemCan(viewingItem, "edit") ? (
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
                  ["Color", renderColorTag(viewingItem)],
                  ["Marca", viewingItem.brand || "—"],
                  ["N.º de parte", viewingItem.partNumber || "—"],
                  ["Categoría", getCategoryLabel(viewingItem.category)],
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
                  ...(canViewPrices
                    ? [
                        ["Costo", formatCurrency(viewingItem.costPrice)],
                        [
                          "Venta",
                          viewingItem.unitPrice > 0
                            ? formatCurrency(viewingItem.unitPrice)
                            : "Pendiente de asignar",
                        ],
                      ]
                    : []),
                  [
                    "Alerta de stock",
                    viewingItem.itemKind === "equipo"
                      ? "—"
                      : viewingItem.stockAlertsEnabled === false
                        ? "Desactivada (el código sigue consultable)"
                        : "Activa",
                  ],
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
                  ...(isEquipment
                    ? []
                    : [
                        [
                          "Caducidad",
                          viewingItem.expiryDate ||
                            trackingFor(stockByProduct.get(viewingItem.id))?.lots.find(
                              (lot) => lot.expiryDate
                            )?.expiryDate ||
                            "—",
                        ],
                      ]),
                  ["Próx. mant.", viewingItem.nextMaintenanceDate || "—"],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <div className="text-sm font-medium">{value}</div>
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
                onOpenSerial={setOpenSerial}
                onOpenLot={setOpenLot}
                canEditUnits={itemCan(viewingItem, "edit")}
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
            itemCan(viewingItem, "edit")
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

      {viewingItem && openSerial ? (
        <SerialUnitDialog
          key={openSerial.id}
          productName={viewingItem.name}
          serial={openSerial}
          canEdit={itemCan(viewingItem, "edit")}
          onClose={() => setOpenSerial(null)}
          onChanged={() => void refreshItems()}
        />
      ) : null}

      {viewingItem && openLot ? (
        <LotUnitDialog
          key={openLot.lot?.id ?? openLot.lotNumber}
          productName={viewingItem.name}
          lot={openLot}
          unit={viewingItem.unit}
          canEdit={itemCan(viewingItem, "edit")}
          onClose={() => setOpenLot(null)}
          onChanged={() => void refreshItems()}
        />
      ) : null}

      {relocatingItem && itemCan(relocatingItem, "edit") ? (
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
