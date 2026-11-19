"use client";
import { Ui } from "@/components/ui/ui-text";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Camera,
  History,
  ImagePlus,
  Plus,
  ScanBarcode,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovementVoucherActions } from "@/components/warehouse/movements/movement-pdf-actions";
import { CameraButton } from "@/components/media/camera-capture";
import { CameraCodeReader } from "@/components/scan/camera-code-reader";
import { ImageLightbox, type LightboxImage } from "@/components/ui/image-lightbox";
import { ModalShell } from "@/components/ui/modal-shell";
import { attachEntryEvidence } from "@/lib/warehouse/entry-evidence";
import { matchesSearch } from "@/lib/search";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import {
  createInventoryItem,
  getInventoryItems,
} from "@/lib/inventory/storage";
import type {
  InventoryItem,
  InventoryItemInput,
} from "@/lib/inventory/types";
import { CATALOG_CATEGORIES } from "@/lib/inventory/types";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import { getSession } from "@/lib/auth";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import {
  ENTRY_REASONS,
  ISSUE_REASONS,
  isServiceIssue,
} from "@/lib/warehouse/reasons";
import {
  createWarehouseLocation,
  DEFAULT_LOCATION_CODES,
  getEntryExitHistory,
  getProductLots,
  getProductWarehouseQuantities,
  getWarehouseLocations,
  getWarehouses,
  findLocationByLabel,
  pickPreferredEntryWarehouse,
  suggestEntryLocation,
  type KardexRow,
  type ProductLot,
  type Warehouse,
  type WarehouseLocation,
  type WarehouseStock,
} from "@/lib/warehouse/stock";
import { useLocale } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { SortableTable } from "@/components/ui/sortable-table";
import { parseSerialNumbers } from "@/lib/inventory/serials";
import { resolveScan, type ScanMatch, type ScanResult } from "@/lib/scan/lookup";
import { dispatchScanResolved } from "@/lib/scan/search-fields";
import { useScanResolved } from "@/lib/scan/use-scan-resolved";
import {
  isEquipmentItem,
  lineFromProduct,
  mergeMovementLine,
  type StockMovementLine,
} from "@/components/warehouse/stock-movement-line";

type MovementMode = "entrada" | "salida";

type StockMovementPanelProps = {
  mode: MovementMode;
};

const NEW_LOCATION = "__new_location__";

type CatalogSort = "categoria" | "nombre" | "sku" | "marca";

const CATALOG_SORT_OPTIONS: { id: CatalogSort; label: string }[] = [
  { id: "categoria", label: "Categoría" },
  { id: "nombre", label: "Nombre" },
  { id: "sku", label: "SKU" },
  { id: "marca", label: "Marca" },
];

const MODE_TABS: {
  id: MovementMode;
  label: string;
  icon: typeof ArrowDownToLine;
}[] = [
  { id: "entrada", label: "Entrada", icon: ArrowDownToLine },
  { id: "salida", label: "Salida", icon: ArrowUpFromLine },
];

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: MovementMode;
  onChange: (next: MovementMode) => void;
}) {
  return (
    <div
      className="flex w-full gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:max-w-sm"
      role="tablist"
      aria-label="Cambiar entre entrada y salida"
    >
      {MODE_TABS.map((item) => {
        const Icon = item.icon;
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium sm:py-2",
              active
                ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

function categoryLabel(item: InventoryItem) {
  if (item.itemKind === "equipo" || item.category === "equipos") return "Equipos";
  return (
    CATALOG_CATEGORIES.find((entry) => entry.id === item.category)?.label ??
    item.category
  );
}

function compareCatalogItems(
  a: InventoryItem,
  b: InventoryItem,
  sort: CatalogSort
) {
  const byName = () => a.name.localeCompare(b.name, "es");
  const bySku = () => a.sku.localeCompare(b.sku, "es");
  const byBrand = () =>
    (a.brand || "\uffff").localeCompare(b.brand || "\uffff", "es") || byName();
  const byCategory = () =>
    categoryLabel(a).localeCompare(categoryLabel(b), "es") ||
    byBrand() ||
    byName() ||
    bySku();

  if (sort === "nombre") return byName() || bySku();
  if (sort === "sku") return bySku() || byName();
  if (sort === "marca") return byBrand() || bySku();
  return byCategory();
}

function articleFields(item: InventoryItem) {
  return [
    item.sku,
    item.name,
    item.brand,
    item.model,
    item.serialNumber,
    item.partNumber,
    item.category,
    categoryLabel(item),
    ...(item.barcodes ?? []),
  ];
}

function withPartNumber(name: string, partNumber: string, model = "") {
  const part = partNumber.trim();
  const base = part ? `${name} · n.º ${part}` : name;
  return `${base} · ${catalogModelLabel(model)}`;
}

function formatLotQty(quantity: number, unit: string) {
  return `${quantity} ${unit}`;
}

function lotSelectLabel(lot: ProductLot, unit: string, scopedToWarehouse: boolean) {
  const here = formatLotQty(lot.warehouseQuantity, unit);
  const total = formatLotQty(lot.quantity, unit);
  const qty =
    scopedToWarehouse && lot.warehouseQuantity !== lot.quantity
      ? `${here} aquí · ${total} total`
      : here;
  return [
    lot.lotNumber,
    qty,
    lot.manufacturedAt ? `fab. ${lot.manufacturedAt}` : "",
    lot.expiryDate ? `cad. ${lot.expiryDate}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function StockMovementPanel({ mode }: StockMovementPanelProps) {
  const router = useRouter();
  const { c } = useLocale();
  const access = useSessionAccess();
  const { canWrite } = usePermissions(mode === "entrada" ? "entradas" : "salidas");
  const canViewEntradas = !access.ready || access.canView("entradas");
  const canViewSalidas = !access.ready || access.canView("salidas");
  const canSwitchModes = canViewEntradas && canViewSalidas;
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[] | null>(null);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [history, setHistory] = useState<KardexRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [locationDrafts, setLocationDrafts] = useState<Record<string, string>>({});
  const locationAutoKeyRef = useRef("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<string>(
    mode === "entrada" ? ENTRY_REASONS[0].id : ISSUE_REASONS[3].id
  );
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufacturedAt, setManufacturedAt] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [technician, setTechnician] = useState("");
  const [relatedSerial, setRelatedSerial] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastFolios, setLastFolios] = useState<string[]>([]);
  const [printOnSave, setPrintOnSave] = useState(true);
  const [equipmentFormOpen, setEquipmentFormOpen] = useState(false);
  const [creatingEquipment, setCreatingEquipment] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceViewer, setEvidenceViewer] = useState<{
    images: LightboxImage[];
    index: number;
  } | null>(null);
  const requiresEvidence = mode === "entrada";
  const evidencePreviews = useMemo(
    () => evidenceFiles.map((file) => URL.createObjectURL(file)),
    [evidenceFiles]
  );
  useEffect(
    () => () => evidencePreviews.forEach((url) => URL.revokeObjectURL(url)),
    [evidencePreviews]
  );

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await getEntryExitHistory(mode, 50);
      setHistory(rows);
    } catch (err) {
      console.error(err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [mode]);

  async function loadCatalog() {
    const data = await getInventoryItems();
    data.sort(
      (a, b) =>
        categoryLabel(a).localeCompare(categoryLabel(b), "es") ||
        a.name.localeCompare(b.name, "es") ||
        a.sku.localeCompare(b.sku, "es")
    );
    setItems(data);
    setItemId((current) =>
      data.some((item) => item.id === current) ? current : ""
    );
    return data;
  }

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadCatalog(), getWarehouses()])
      .then(([, warehouseList]) => {
        setWarehouses(warehouseList);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el inventario."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    setReason(mode === "entrada" ? ENTRY_REASONS[0].id : ISSUE_REASONS[3].id);
    setMessage("");
    setError("");
    setLastFolios([]);
    setLines([]);
    setScanHint("");
    if (mode !== "entrada") {
      setEvidenceFiles([]);
    }
  }, [mode]);

  function switchMode(next: MovementMode) {
    if (next === mode) return;
    const tab = next === "entrada" ? "entradas" : "salidas";
    const allowed = next === "entrada" ? canViewEntradas : canViewSalidas;
    if (!allowed) return;
    router.push(`/dashboard/almacen?tab=${tab}`, { scroll: false });
  }

  useEffect(() => {
    if (!warehouseId) {
      setLocations([]);
      setLocationId("");
      return;
    }
    void getWarehouseLocations(warehouseId)
      .then((rows) => {
        setLocations(rows);
        setLocationId((current) =>
          current &&
          current !== NEW_LOCATION &&
          rows.some((row) => row.id === current)
            ? current
            : ""
        );
        setLines((current) =>
          current.map((line) =>
            rows.some((row) => row.id === line.locationId)
              ? line
              : { ...line, locationId: "" }
          )
        );
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar ubicaciones.")
      );
  }, [warehouseId]);

  const selected = useMemo(
    () => items.find((item) => item.id === itemId) ?? null,
    [items, itemId]
  );
  const isEquipmentCatalog =
    selected?.itemKind === "equipo" || selected?.category === "equipos";
  const selectedLot = useMemo(
    () => lots.find((lot) => lot.lotNumber === lotNumber) ?? null,
    [lots, lotNumber]
  );
  const unitLabel = selected?.unit || "pza";

  const [itemQuery, setItemQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("todas");
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("categoria");
  const [historyQuery, setHistoryQuery] = useState("");
  const [scanHint, setScanHint] = useState("");
  /** Al escanear, agrega directo a la lista multi-producto. */
  const [autoAddOnScan, setAutoAddOnScan] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [cameraBusy, setCameraBusy] = useState(false);
  const lastCameraScanRef = useRef({ code: "", at: 0 });
  const [lines, setLines] = useState<StockMovementLine[]>([]);
  /** Historial oculto por defecto para dejar espacio al formulario. */
  const [showHistory, setShowHistory] = useState(false);
  const quantityRef = useRef<HTMLInputElement>(null);
  const lotRef = useRef<HTMLInputElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);
  const serialAreaRef = useRef<HTMLTextAreaElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const handleCameraCode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || cameraBusy) return;
      const now = Date.now();
      if (
        code === lastCameraScanRef.current.code &&
        now - lastCameraScanRef.current.at < 2500
      ) {
        setCameraKey((key) => key + 1);
        return;
      }
      lastCameraScanRef.current = { code, at: now };
      setCameraBusy(true);
      setScanHint("Leyendo código con la cámara…");
      try {
        const result = await resolveScan(code);
        dispatchScanResolved(code, result);
        if (!result.matches.length) {
          setScanHint(
            `Código leído (${code}): sin producto vinculado. Vincula el código o elige el artículo.`
          );
        }
      } catch (reason) {
        setScanHint(
          reason instanceof Error
            ? reason.message
            : "No se pudo resolver el código de la cámara."
        );
      } finally {
        setCameraBusy(false);
        // Remonta el lector para poder escanear el siguiente producto.
        setCameraKey((key) => key + 1);
      }
    },
    [cameraBusy]
  );

  const clearDraft = useCallback(() => {
    setItemId("");
    setItemQuery("");
    setQuantity(1);
    setLotNumber("");
    setExpiryDate("");
    setManufacturedAt("");
    setSerialNumber("");
  }, []);
  const catalogCategories = useMemo(() => {
    const present = new Set(items.map((item) => item.category));
    return CATALOG_CATEGORIES.filter((entry) => present.has(entry.id));
  }, [items]);

  const catalogBrands = useMemo(() => {
    const brands = new Set(
      items.map((item) => item.brand.trim()).filter(Boolean)
    );
    return [...brands].sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const hasCatalogFilters =
    categoryFilter !== "all" || brandFilter !== "todas" || Boolean(itemQuery.trim());

  const itemOptions = useMemo(() => {
    const filtered = items.filter((item) => {
      if (item.id === itemId) return true;
      if (categoryFilter !== "all") {
        const isEquipment =
          item.itemKind === "equipo" || item.category === "equipos";
        if (categoryFilter === "equipos") {
          if (!isEquipment) return false;
        } else if (item.category !== categoryFilter) {
          return false;
        }
      }
      if (brandFilter === "sin_marca") {
        if (item.brand.trim()) return false;
      } else if (brandFilter !== "todas" && item.brand.trim() !== brandFilter) {
        return false;
      }
      if (itemQuery.trim() && !matchesSearch(itemQuery, articleFields(item))) {
        return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) =>
      compareCatalogItems(a, b, catalogSort)
    );
    // Con filtros: muestra más resultados; sin filtros, recorta para no saturar.
    const limit = hasCatalogFilters ? 200 : 60;
    return sorted.slice(0, limit);
  }, [
    items,
    itemQuery,
    itemId,
    categoryFilter,
    brandFilter,
    catalogSort,
    hasCatalogFilters,
  ]);

  const groupedItemOptions = useMemo(() => {
    if (catalogSort !== "categoria") return null;
    const groups: { label: string; items: InventoryItem[] }[] = [];
    for (const item of itemOptions) {
      const label = categoryLabel(item);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [itemOptions, catalogSort]);

  const applyScanMatch = useCallback(
    async ({ match, result }: { match: ScanMatch | null; result: ScanResult }) => {
      if (equipmentFormOpen) return;
      if (!match) {
        setScanHint(
          "Código leído sin producto vinculado. Vincula el código en la ficha del escáner o elige el modelo y captura la serie."
        );
        return;
      }
      const { scan } = result;
      const local = items.find((item) => item.id === match.item.id) ?? match.item;
      // Priorizar GS1 del escaneo actual para no heredar lote/caducidad de otro match.
      const lot = scan.gs1?.lot || match.lotNumber || "";
      const serial =
        scan.gs1?.serial ||
        match.serialNumber ||
        (match.kind === "equipment_serial" || match.kind === "serial"
          ? scan.code
          : "");
      const expiry = scan.gs1?.expiry || match.expiryDate || "";
      const manufactured = scan.gs1?.productionDate || "";
      const partRef = (
        local.partNumber ||
        scan.gs1?.ais?.["240"] ||
        scan.gs1?.ais?.["241"] ||
        ""
      ).trim();
      const qtyRaw = scan.gs1?.quantity;
      let qty = 1;
      if (qtyRaw && /^\d+(\.\d+)?$/.test(qtyRaw)) {
        const parsed = Number(qtyRaw);
        if (parsed > 0) qty = parsed;
      }
      const samePartModels = result.matches.filter(
        (row) =>
          isEquipmentItem(row.item) &&
          (row.item.partNumber || "").trim() &&
          (row.item.partNumber || "").trim() === (local.partNumber || "").trim()
      );
      const needsModelConfirm = samePartModels.length > 1;
      const ambiguous =
        result.matches.length > 1
          ? needsModelConfirm
            ? ` · Hay ${samePartModels.length} modelos con la misma ref. (${samePartModels
                .map((row) => row.item.model || row.item.name)
                .slice(0, 3)
                .join(", ")}). Confirma el correcto.`
            : ` · ${result.matches.length} coincidencias (se eligió la más probable)`
          : "";
      const suggestion =
        mode === "entrada" && warehouseId
          ? await suggestEntryLocation({
              productId: local.id,
              warehouseId,
              locations,
              catalogLocation: local.location,
            })
          : { locationId: "", pendingName: "" };
      const registeredName = suggestion.locationId
        ? locations.find((row) => row.id === suggestion.locationId)?.name ?? ""
        : "";
      if (mode === "entrada") {
        if (suggestion.locationId) {
          setLocationId(suggestion.locationId);
          setNewLocationName("");
        } else if (suggestion.pendingName) {
          setLocationId(NEW_LOCATION);
          setNewLocationName(suggestion.pendingName);
        } else {
          setLocationId("");
        }
      }

      if (autoAddOnScan && needsModelConfirm) {
        setItemId(local.id);
        setItemQuery(local.sku);
        if (lot) setLotNumber(lot);
        if (serial) setSerialNumber(serial);
        if (expiry) setExpiryDate(expiry);
        if (manufactured) setManufacturedAt(manufactured);
        setQuantity(qty);
        setScanHint(`Escaneado ${local.sku}${ambiguous}`);
        setError("");
        setMessage("");
        return;
      }

      if (autoAddOnScan) {
        const isEquip = isEquipmentItem(local);
        if ((isEquip || local.tracksSerial) && !serial.trim() && mode === "entrada") {
          setItemId(local.id);
          setItemQuery(local.sku);
          setLotNumber(lot);
          setExpiryDate(expiry);
          setManufacturedAt(manufactured);
          setQuantity(qty);
          setScanHint(
            `Escaneado ${local.sku}: captura la serie y pulsa «Agregar a la lista».${ambiguous}`
          );
          window.setTimeout(() => {
            (serialAreaRef.current ?? serialInputRef.current)?.focus();
          }, 50);
          return;
        }
        if (mode === "entrada" && local.tracksLot && !isEquip && !lot.trim()) {
          setItemId(local.id);
          setItemQuery(local.sku);
          setExpiryDate(expiry);
          setManufacturedAt(manufactured);
          setQuantity(qty);
          setSerialNumber(serial);
          setScanHint(
            `Escaneado ${local.sku}: captura el lote y pulsa «Agregar a la lista».${ambiguous}`
          );
          window.setTimeout(() => lotRef.current?.focus(), 50);
          return;
        }
        const next = lineFromProduct(local, {
          quantity: isEquip ? 1 : qty,
          lotNumber: isEquip ? "" : lot,
          expiryDate: isEquip ? "" : expiry,
          manufacturedAt: manufactured,
          serialNumber: serial,
          locationId: suggestion.locationId,
          partNumber: partRef,
        });
        setLines((current) => mergeMovementLine(current, next));
        if (!suggestion.locationId) {
          setLocationDrafts((current) => ({
            ...current,
            [next.key]: suggestion.pendingName,
          }));
        }
        clearDraft();
        const placeHint = registeredName
          ? ` Ubicación ${registeredName}.`
          : suggestion.pendingName
            ? ` Confirma o escribe la ubicación «${suggestion.pendingName}».`
            : " Escribe la ubicación en la línea.";
        setScanHint(
          `Agregado: ${partRef ? `ref. ${partRef} · ` : ""}${local.sku}.${ambiguous}${placeHint} Escanea el siguiente o confirma la lista.`
        );
        setError("");
        setMessage("");
        return;
      }

      setItemId(local.id);
      setItemQuery(local.sku);
      if (lot) setLotNumber(lot);
      if (serial) setSerialNumber(serial);
      if (expiry) setExpiryDate(expiry);
      if (manufactured) setManufacturedAt(manufactured);
      setQuantity(qty);
      const extras = [
        partRef ? `ref. ${partRef}` : "",
        lot ? `lote ${lot}` : "",
        manufactured ? `fab. ${manufactured}` : "",
        serial ? `serie ${serial}` : "",
        expiry ? `cad. ${expiry}` : "",
        qty > 1 ? `cant. ${qty}` : "",
      ].filter(Boolean);
      setScanHint(
        extras.length
          ? `Escaneado: ${local.sku} · ${extras.join(" · ")}${ambiguous}`
          : `Escaneado: ${local.sku} — ${local.name}${ambiguous}`
      );
      setError("");
      setMessage("");
      window.setTimeout(() => {
        if (isEquipmentItem(local) || local.tracksSerial) {
          (serialAreaRef.current ?? serialInputRef.current)?.focus();
          return;
        }
        if (mode === "entrada" && local.tracksLot && !lot) {
          lotRef.current?.focus();
          return;
        }
        quantityRef.current?.focus();
        quantityRef.current?.select();
      }, 50);
    },
    [
      equipmentFormOpen,
      items,
      mode,
      autoAddOnScan,
      clearDraft,
      warehouseId,
      locations,
    ]
  );
  useScanResolved(applyScanMatch, { enabled: !equipmentFormOpen });
  const visibleHistory = useMemo(
    () =>
      history.filter((row) =>
        matchesSearch(historyQuery, [
          row.folio,
          row.productSku,
          row.productName,
          row.partNumber,
          row.productModel,
          row.reason,
          row.note,
          row.createdBy,
        ])
      ),
    [history, historyQuery]
  );

  const warehouseQty = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of warehouseStock ?? []) map.set(row.warehouseId, row.quantity);
    return map;
  }, [warehouseStock]);

  const stockedWarehouses = useMemo(() => {
    // Con varias líneas el almacén es compartido; en entrada no filtramos por stock.
    if (mode === "entrada" || lines.length > 0) return warehouses;
    if (!itemId || warehouseStock === null) return warehouses;
    const withStock = warehouses.filter(
      (warehouse) => (warehouseQty.get(warehouse.id) ?? 0) > 0
    );
    return withStock.length > 0 ? withStock : [];
  }, [itemId, warehouseStock, warehouses, warehouseQty, mode, lines.length]);

  const listingStockedWarehouses =
    Boolean(itemId) &&
    lines.length === 0 &&
    warehouseStock !== null &&
    stockedWarehouses.length > 0 &&
    stockedWarehouses.length < warehouses.length;

  const loadWarehouseStock = useCallback(async () => {
    if (!itemId) {
      setWarehouseStock([]);
      return [];
    }
    try {
      const rows = await getProductWarehouseQuantities(itemId);
      setWarehouseStock(rows);
      return rows;
    } catch {
      setWarehouseStock([]);
      return [];
    }
  }, [itemId]);

  useEffect(() => {
    setWarehouseStock(null);
    void loadWarehouseStock();
  }, [loadWarehouseStock]);

  useEffect(() => {
    if (stockedWarehouses.length === 0) {
      if (mode === "salida") setWarehouseId("");
      return;
    }
    setWarehouseId((current) => {
      if (stockedWarehouses.some((warehouse) => warehouse.id === current)) {
        return current;
      }
      if (mode === "entrada") {
        return pickPreferredEntryWarehouse(stockedWarehouses)?.id ?? stockedWarehouses[0].id;
      }
      return stockedWarehouses[0].id;
    });
  }, [stockedWarehouses, mode]);

  // En entradas, productos ya registrados prefieren VSA (si aún no hay líneas en otro almacén).
  useEffect(() => {
    if (mode !== "entrada" || lines.length > 0 || warehouses.length === 0) return;
    const preferred = pickPreferredEntryWarehouse(warehouses);
    if (!preferred) return;
    const registered = (warehouseStock ?? []).some((row) => row.quantity > 0);
    if (registered || !itemId) {
      setWarehouseId(preferred.id);
    }
  }, [mode, itemId, warehouseStock, warehouses, lines.length]);

  const physicalLocations = useMemo(
    () =>
      locations.filter(
        (loc) => !DEFAULT_LOCATION_CODES.includes(loc.code.toUpperCase())
      ),
    [locations]
  );
  const genericLocations = useMemo(
    () =>
      locations.filter((loc) =>
        DEFAULT_LOCATION_CODES.includes(loc.code.toUpperCase())
      ),
    [locations]
  );

  const resolveLocationForProduct = useCallback(
    async (product: InventoryItem) => {
      if (!warehouseId || locations.length === 0) return "";
      const suggestion = await suggestEntryLocation({
        productId: product.id,
        warehouseId,
        locations,
        catalogLocation: product.location,
      });
      return suggestion.locationId;
    },
    [warehouseId, locations]
  );

  useEffect(() => {
    if (mode !== "entrada" || !warehouseId || locations.length === 0) return;
    const autoKey = `${warehouseId}::${itemId || "none"}::${locations.length}`;
    if (locationAutoKeyRef.current === autoKey) return;
    locationAutoKeyRef.current = autoKey;
    let cancelled = false;
    void (async () => {
      if (selected) {
        const suggestion = await suggestEntryLocation({
          productId: selected.id,
          warehouseId,
          locations,
          catalogLocation: selected.location,
        });
        if (cancelled) return;
        if (suggestion.locationId) {
          setLocationId(suggestion.locationId);
          setNewLocationName("");
        } else {
          setLocationId(suggestion.pendingName ? NEW_LOCATION : "");
          setNewLocationName(suggestion.pendingName);
        }
        return;
      }
      if (!cancelled) {
        setLocationId("");
        setNewLocationName("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mode,
    warehouseId,
    itemId,
    selected,
    locations,
  ]);

  async function handleCreateLocation(name: string, applyToLineKey?: string) {
    const trimmed = name.trim();
    if (!warehouseId || !trimmed) {
      setError("Escribe el nombre de la nueva ubicación.");
      return;
    }
    setCreatingLocation(true);
    setError("");
    try {
      const existing = findLocationByLabel(locations, trimmed);
      const created =
        existing ?? (await createWarehouseLocation(warehouseId, trimmed));
      if (!existing) {
        setLocations((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name, "es"))
        );
      }
      setLocationId(created.id);
      setNewLocationName("");
      if (applyToLineKey) {
        setLines((current) =>
          current.map((line) =>
            line.key === applyToLineKey
              ? { ...line, locationId: created.id }
              : line
          )
        );
        setLocationDrafts((current) => ({ ...current, [applyToLineKey]: "" }));
      } else {
        setLines((current) =>
          current.map((line) =>
            !line.locationId || line.locationId === NEW_LOCATION
              ? { ...line, locationId: created.id }
              : line
          )
        );
      }
      setMessage(`Ubicación «${created.name}» creada.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear la ubicación."
      );
    } finally {
      setCreatingLocation(false);
    }
  }

  const loadLots = useCallback(async () => {
    if (!itemId || isEquipmentCatalog) {
      setLots([]);
      return [];
    }
    try {
      const rows = await getProductLots(itemId, warehouseId || null);
      setLots(rows);
      return rows;
    } catch {
      setLots([]);
      return [];
    }
  }, [itemId, isEquipmentCatalog, warehouseId]);

  useEffect(() => {
    void loadLots().then((rows) => {
      if (mode !== "salida") return;
      const pick = rows[0];
      setLotNumber(pick?.lotNumber ?? "");
      setExpiryDate(pick?.expiryDate ?? "");
      setManufacturedAt(pick?.manufacturedAt ?? "");
    });
  }, [loadLots, mode]);

  useEffect(() => {
    if (mode !== "entrada") return;
    setLotNumber("");
    setExpiryDate("");
    setManufacturedAt("");
  }, [itemId, mode]);

  useEffect(() => {
    if (isEquipmentCatalog && mode !== "entrada") {
      setQuantity(1);
      setLotNumber("");
      setExpiryDate("");
      setManufacturedAt("");
    }
  }, [isEquipmentCatalog, mode]);

  async function handleCreateEquipment(data: InventoryItemInput) {
    try {
      setCreatingEquipment(true);
      setError("");
      setMessage("");
      const session = getSession();
      if (!session?.username) {
        throw new Error("Inicia sesión para dar de alta el equipo.");
      }
      const created = await createInventoryItem(
        {
          ...data,
          itemKind: "equipo",
          category: "equipos",
          quantity: 0,
        },
        session.username
      );
      const next = await loadCatalog();
      if (!next.some((item) => item.id === created.id)) {
        setItems([created, ...next]);
      }
      setItemId(created.id);
      setItemQuery("");
      setSerialNumber("");
      setEquipmentFormOpen(false);
      setMessage(
        `Equipo ${created.sku} dado de alta. Captura las series en esta entrada.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo dar de alta el equipo."
      );
    } finally {
      setCreatingEquipment(false);
    }
  }

  async function buildLinesFromDraft(): Promise<StockMovementLine[]> {
    if (!selected) return [];
    const isEquip = isEquipmentCatalog;
    const resolvedLocation =
      mode === "entrada"
        ? (await resolveLocationForProduct(selected)) || locationId
        : locationId;
    if (isEquip && mode === "entrada") {
      const serials = parseSerialNumbers(serialNumber);
      return serials.map((serial) =>
        lineFromProduct(selected, {
          quantity: 1,
          serialNumber: serial,
          manufacturedAt,
          locationId: resolvedLocation,
        })
      );
    }
    return [
      lineFromProduct(selected, {
        quantity: isEquip ? 1 : quantity,
        lotNumber: isEquip ? "" : lotNumber,
        expiryDate: isEquip ? "" : expiryDate,
        manufacturedAt,
        serialNumber: serialNumber.trim(),
        locationId: resolvedLocation,
      }),
    ];
  }

  async function addDraftToLines() {
    if (!canWrite || !selected) {
      setError("Elige un artículo para agregarlo a la lista.");
      return;
    }
    try {
      if (mode === "entrada" && selected.tracksLot && !isEquipmentCatalog && !lotNumber.trim()) {
        throw new Error("Este producto exige número de lote.");
      }
      if (isEquipmentCatalog && mode === "entrada") {
        parseSerialNumbers(serialNumber);
      } else if (
        (selected.tracksSerial || isEquipmentCatalog) &&
        !serialNumber.trim()
      ) {
        throw new Error(
          isEquipmentCatalog
            ? "Indica el número de serie."
            : "Este producto exige número de serie."
        );
      }
      const built = await buildLinesFromDraft();
      if (built.length === 0) {
        throw new Error("No hay datos para agregar.");
      }
      let total = 0;
      setLines((current) => {
        let next = current;
        for (const line of built) next = mergeMovementLine(next, line);
        total = next.length;
        return next;
      });
      clearDraft();
      setScanHint(
        `Agregado: ${selected.sku} · ${total} producto${total === 1 ? "" : "s"} en la lista.`
      );
      setError("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;

    let pending = lines;
    if (pending.length === 0 && selected) {
      try {
        if (mode === "entrada" && selected.tracksLot && !isEquipmentCatalog && !lotNumber.trim()) {
          throw new Error("Este producto exige número de lote.");
        }
        if (isEquipmentCatalog && mode === "entrada") {
          parseSerialNumbers(serialNumber);
        } else if (
          (selected.tracksSerial || isEquipmentCatalog) &&
          !serialNumber.trim()
        ) {
          throw new Error(
            isEquipmentCatalog
              ? "Indica el número de serie de la pieza que sale."
              : "Este producto exige número de serie."
          );
        }
        pending = await buildLinesFromDraft();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Revisa los datos.");
        return;
      }
    }
    if (pending.length === 0) {
      setError("Agrega al menos un producto a la lista (escanea o pulsa «Agregar a la lista»).");
      return;
    }
    if (!warehouseId) {
      setError("Selecciona un almacén.");
      return;
    }

    for (const line of pending) {
      if (mode === "entrada" && (!line.locationId || line.locationId === NEW_LOCATION)) {
        setError(
          `${line.sku}: elige una ubicación o crea una nueva antes de registrar la entrada.`
        );
        return;
      }
      if (mode === "entrada" && line.tracksLot && !line.lotNumber.trim()) {
        setError(`${line.sku}: exige número de lote.`);
        return;
      }
      if (line.tracksSerial && !line.serialNumber.trim()) {
        setError(`${line.sku}: exige número de serie.`);
        return;
      }
      if (!line.isEquipment && line.quantity < 1) {
        setError(`${line.sku}: la cantidad debe ser al menos 1.`);
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const session = getSession();
      if (!session?.username) {
        throw new Error("Inicia sesión para registrar el movimiento.");
      }
      const reasonLabel =
        mode === "entrada"
          ? ENTRY_REASONS.find((item) => item.id === reason)?.label ?? reason
          : ISSUE_REASONS.find((item) => item.id === reason)?.label ?? reason;
      const extraNote = [
        note,
        technician ? `Técnico: ${technician}` : "",
        relatedSerial ? `Serie relacionada: ${relatedSerial}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const { applyStockMovement } = await import("@/lib/warehouse/stock");
      const results: Array<{
        folio: string;
        movementId: string;
        newQuantity: number;
        productId: string;
        unit: string;
      }> = [];

      // Una sola entrada/salida: todas las partidas comparten el mismo folio.
      let sharedFolio: string | null = null;
      for (const line of pending) {
        const movement = await applyStockMovement({
          productId: line.productId,
          movementType: mode,
          createdBy: session.username,
          note: extraNote,
          reason: reasonLabel,
          warehouseId: warehouseId || null,
          locationId: line.locationId || locationId || null,
          lotNumber: line.isEquipment ? null : line.lotNumber || null,
          expiryDate: line.isEquipment ? null : line.expiryDate || null,
          manufacturedAt: line.manufacturedAt || null,
          quantity: line.isEquipment ? 1 : line.quantity,
          serialNumber: line.serialNumber.trim() || null,
          folio: sharedFolio,
        });
        if (!sharedFolio) sharedFolio = movement.folio;
        results.push({
          ...movement,
          productId: line.productId,
          unit: line.unit,
        });
      }

      const batchFolio = sharedFolio || results[0]?.folio || "";
      const qtyByProduct = new Map(
        results.map((item) => [item.productId, item.newQuantity] as const)
      );
      setItems((current) =>
        current.map((item) =>
          qtyByProduct.has(item.id)
            ? { ...item, quantity: qtyByProduct.get(item.id)! }
            : item
        )
      );

      let evidenceNote = "";
      if (requiresEvidence && evidenceFiles.length > 0) {
        try {
          for (const movement of results) {
            await attachEntryEvidence(movement.movementId, evidenceFiles);
          }
          evidenceNote = " Evidencia integrada a los movimientos.";
          setEvidenceFiles([]);
        } catch (evidenceError) {
          setError(
            `Se registró ${batchFolio}, pero no se pudo guardar la evidencia: ${
              evidenceError instanceof Error
                ? evidenceError.message
                : "error desconocido"
            }`
          );
        }
      }

      const uniqueFolios = batchFolio ? [batchFolio] : [];
      const label =
        mode === "entrada"
          ? pending.length > 1
            ? `Entrada ${batchFolio} · ${pending.length} productos.`
            : `Entrada ${batchFolio}.`
          : pending.length > 1
            ? `Salida ${batchFolio} · ${pending.length} productos.`
            : `Salida ${batchFolio}.`;
      setMessage(`${label}${evidenceNote}`);
      setLastFolios(uniqueFolios);
      setLines([]);
      clearDraft();
      setNote("");
      setTechnician("");
      setRelatedSerial("");
      setScanHint("Listo: escanea el siguiente lote de productos.");
      await Promise.all([loadHistory(), loadLots(), loadWarehouseStock()]);

      if (printOnSave && uniqueFolios.length > 0) {
        try {
          const [{ getMovementsByFolio }, { downloadMovementVoucherPdf }] =
            await Promise.all([
              import("@/lib/warehouse/movements"),
              import("@/lib/warehouse/movements-pdf"),
            ]);
          const records = await getMovementsByFolio(uniqueFolios);
          await downloadMovementVoucherPdf(records, {
            warehouses,
            output: "print",
          });
        } catch (printError) {
          setError(
            printError instanceof Error
              ? `Registrado, pero no se pudo abrir el PDF: ${printError.message}`
              : "Registrado, pero no se pudo abrir el PDF para imprimir."
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el movimiento."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {canSwitchModes ? (
          <div className="mb-4">
            <ModeSwitch mode={mode} onChange={switchMode} />
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">Cargando catálogo...</p>
      </section>
    );
  }

  const reasons = mode === "entrada" ? ENTRY_REASONS : ISSUE_REASONS;
  const showServiceFields = mode === "salida" && isServiceIssue(reason);

  return (
    <>
      <div
        className={cn(
          "grid gap-4 lg:items-start",
          showHistory
            ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]"
            : "grid-cols-1"
        )}
      >
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {mode === "entrada" ? "Registrar entrada" : "Registrar salida"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mode === "entrada"
                    ? "Escanea varios productos a la lista y confírmalos en una sola entrada (mismo folio). Con GS1 se rellenan lote/serie/caducidad."
                    : "Escanea varios productos a la lista y confírmalos en una sola salida (mismo folio)."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowHistory((current) => !current)}
                  className="shrink-0"
                >
                  <History className="size-4" />
                  {showHistory ? "Ocultar historial" : "Ver historial"}
                </Button>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setError("");
                      setEquipmentFormOpen(true);
                    }}
                    className="shrink-0"
                  >
                    <Plus className="size-4" /> <Ui>Dar de alta equipo</Ui></Button>
                ) : null}
              </div>
            </div>
            {canSwitchModes ? (
              <ModeSwitch mode={mode} onChange={switchMode} />
            ) : null}
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-[#00BFFF]/35 bg-[#00BFFF]/5 px-3 py-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-sm">
                <ScanBarcode className="mt-0.5 size-4 shrink-0 text-[#00BFFF]" />
                <div>
                  <p className="font-medium text-foreground">
                    Lector listo
                    {lines.length > 0
                      ? ` · ${lines.length} en la lista`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {scanHint ||
                      "Usa el lector HID o la cámara del celular. Si es GS1, lote/serie/caducidad se cargan solos."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={cameraOpen ? "secondary" : "default"}
                  size="sm"
                  disabled={!canWrite}
                  onClick={() => setCameraOpen((open) => !open)}
                  className="touch-target h-10 gap-1.5"
                >
                  <Camera className="size-4" />
                  {cameraOpen ? "Cerrar cámara" : "Escanear con cámara"}
                </Button>
                <label className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={autoAddOnScan}
                    onChange={(event) => setAutoAddOnScan(event.target.checked)}
                    className="size-3.5 rounded border-input"
                  />
                  Al escanear, agregar a la lista
                </label>
              </div>
            </div>
            {cameraOpen ? (
              <div className="rounded-xl border border-border bg-background p-2">
                <CameraCodeReader key={cameraKey} onDetected={(code) => void handleCameraCode(code)} />
                {cameraBusy ? (
                  <p className="mt-2 text-xs font-medium text-[#00BFFF]">
                    Procesando código…
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Apunta al código de barras o DataMatrix; se agrega a la lista automáticamente.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <ReadOnlyBanner visible={!canWrite} />
          </div>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium"><Ui>Tipo de registro</Ui></span>
              <select
                value={reason}
                disabled={!canWrite}
                onChange={(event) => setReason(event.target.value)}
                className={cn(
                  fieldClass,
                  "border-[#3B46A5]/35 bg-background font-medium"
                )}
              >
                {reasons.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              {/* Izquierda: buscador + indicadores de almacén */}
              <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Buscador y almacén
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Escanea o busca; a la derecha verás lo ya añadido.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium"><Ui>Almacén</Ui></span>
                    <select
                      required
                      value={warehouseId}
                      onChange={(event) => setWarehouseId(event.target.value)}
                      disabled={!canWrite || stockedWarehouses.length === 0}
                      className={fieldClass}
                    >
                      {stockedWarehouses.length === 0 ? (
                        <option value="">
                          {mode === "salida"
                            ? "Sin existencia en ningún almacén"
                            : "No hay almacenes disponibles"}
                        </option>
                      ) : (
                        stockedWarehouses.map((warehouse) => {
                          const qty = warehouseQty.get(warehouse.id);
                          const showQty =
                            Boolean(selected) &&
                            lines.length === 0 &&
                            qty != null &&
                            qty > 0;
                          return (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.code} — {warehouse.name}
                              {showQty
                                ? ` · ${formatLotQty(qty, unitLabel)}`
                                : ""}
                            </option>
                          );
                        })
                      )}
                    </select>
                    {listingStockedWarehouses ? (
                      <span className="block text-xs text-muted-foreground">
                        Solo almacenes con existencia de este artículo.
                      </span>
                    ) : mode === "entrada" ? (
                      <span className="block text-xs text-muted-foreground">
                        Preferencia: VSA (Villahermosa). Puedes cambiarlo si la
                        entrada va a otro almacén.
                      </span>
                    ) : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">
                      Ubicación por defecto
                    </span>
                    <select
                      value={locationId}
                      onChange={(event) => {
                        const value = event.target.value;
                        setLocationId(value);
                        if (value !== NEW_LOCATION) setNewLocationName("");
                      }}
                      disabled={!canWrite || !warehouseId}
                      className={fieldClass}
                    >
                      {!warehouseId ? (
                        <option value="">Elige un almacén primero</option>
                      ) : locations.length === 0 ? (
                        <option value="">Sin ubicaciones — crea una</option>
                      ) : (
                        <>
                          <option value="">Elegir ubicación…</option>
                          {physicalLocations.length > 0 ? (
                            <optgroup label="Ubicaciones físicas">
                              {physicalLocations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.code} — {location.name}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                          {genericLocations.length > 0 ? (
                            <optgroup label="Genéricas por categoría">
                              {genericLocations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.code} — {location.name}
                                </option>
                              ))}
                            </optgroup>
                          ) : null}
                        </>
                      )}
                      {warehouseId ? (
                        <option value={NEW_LOCATION}>+ Nueva ubicación…</option>
                      ) : null}
                    </select>
                    <span className="block text-xs text-muted-foreground">
                      Al escanear se pone la ubicación que el producto ya
                      tiene. Si no tiene, escríbela en la línea.
                    </span>
                  </label>
                </div>

                {mode === "entrada" && locationId === NEW_LOCATION ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1 space-y-1.5">
                      <span className="text-sm font-medium">
                        Nombre de la nueva ubicación
                      </span>
                      <input
                        value={newLocationName}
                        onChange={(event) =>
                          setNewLocationName(event.target.value)
                        }
                        placeholder="Ej. Rack A / Nivel 2"
                        disabled={!canWrite || creatingLocation}
                        className={fieldClass}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateLocation(newLocationName);
                          }
                        }}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        !canWrite ||
                        creatingLocation ||
                        !newLocationName.trim()
                      }
                      onClick={() => void handleCreateLocation(newLocationName)}
                    >
                      {creatingLocation ? "Creando…" : "Crear ubicación"}
                    </Button>
                  </div>
                ) : null}

                {selected || lines.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-2.5 text-xs sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">En lista</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {lines.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Almacenes</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {stockedWarehouses.length || warehouses.length}
                      </p>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-muted-foreground">
                        {selected ? `Stock ${selected.sku}` : "Stock catálogo"}
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {selected
                          ? `${selected.quantity} ${selected.unit || "pza"}`
                          : "—"}
                      </p>
                    </div>
                  </div>
                ) : null}

                {items.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {c("Categoría")}
                        </span>
                        <select
                          value={categoryFilter}
                          onChange={(event) =>
                            setCategoryFilter(event.target.value)
                          }
                          className={fieldClass}
                          aria-label={c("Categoría")}
                        >
                          <option value="all">{c("Todas")}</option>
                          {catalogCategories.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {c(entry.label)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {c("Marca")}
                        </span>
                        <select
                          value={brandFilter}
                          onChange={(event) =>
                            setBrandFilter(event.target.value)
                          }
                          className={fieldClass}
                          aria-label={c("Marca")}
                        >
                          <option value="todas">{c("Todas")}</option>
                          {catalogBrands.map((brand) => (
                            <option key={brand} value={brand}>
                              {brand}
                            </option>
                          ))}
                          {items.some((item) => !item.brand.trim()) ? (
                            <option value="sin_marca">{c("Sin marca")}</option>
                          ) : null}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {c("Ordenar")}
                        </span>
                        <select
                          value={catalogSort}
                          onChange={(event) =>
                            setCatalogSort(event.target.value as CatalogSort)
                          }
                          className={fieldClass}
                          aria-label={c("Ordenar")}
                        >
                          {CATALOG_SORT_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {c(option.label)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {hasCatalogFilters ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground">
                          {itemOptions.length}{" "}
                          {itemOptions.length === 1
                            ? c("Artículo").toLowerCase()
                            : c("Artículos").toLowerCase()}
                          {categoryFilter !== "all" || brandFilter !== "todas"
                            ? ` · ${c("Filtros")} activos`
                            : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setCategoryFilter("all");
                            setBrandFilter("todas");
                            setItemQuery("");
                            setItemId("");
                            setScanHint("");
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-3" />
                          {c("Quitar filtros")}
                        </button>
                      </div>
                    ) : null}
                    <SearchInput
                      value={itemQuery}
                      onChange={(value) => {
                        setItemQuery(value);
                        setScanHint("");
                        if (!value.trim()) {
                          setItemId("");
                          return;
                        }
                        const first = items.find((item) => {
                          if (categoryFilter !== "all") {
                            const isEquipment =
                              item.itemKind === "equipo" ||
                              item.category === "equipos";
                            if (categoryFilter === "equipos") {
                              if (!isEquipment) return false;
                            } else if (item.category !== categoryFilter) {
                              return false;
                            }
                          }
                          if (brandFilter === "sin_marca") {
                            if (item.brand.trim()) return false;
                          } else if (
                            brandFilter !== "todas" &&
                            item.brand.trim() !== brandFilter
                          ) {
                            return false;
                          }
                          return matchesSearch(value, articleFields(item));
                        });
                        if (first) setItemId(first.id);
                      }}
                      scanSearch="true"
                      placeholder="Buscar o escanear por código, nombre, n.º de parte..."
                    />
                  </div>
                ) : null}
                {scanHint ? (
                  <p className="text-xs font-medium text-[#00BFFF]">{scanHint}</p>
                ) : null}
                <div className="max-h-[22rem] overflow-y-auto rounded-lg border border-border bg-background">
                  {items.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No hay artículos en el catálogo.
                    </p>
                  ) : itemOptions.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Sin coincidencias. Prueba otro filtro o término.
                    </p>
                  ) : groupedItemOptions ? (
                    <div className="divide-y divide-border">
                      {groupedItemOptions.map((group) => (
                        <div key={group.label}>
                          <p className="sticky top-0 z-[1] bg-muted/90 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur-sm">
                            {c(group.label)} · {group.items.length}
                          </p>
                          <ul className="divide-y divide-border/70">
                            {group.items.map((item) => {
                              const active = item.id === itemId;
                              return (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    disabled={!canWrite}
                                    onClick={() => {
                                      setItemId(item.id);
                                      setItemQuery(item.sku);
                                      setScanHint("");
                                    }}
                                    className={cn(
                                      "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted/60",
                                      active && "bg-[#00BFFF]/10"
                                    )}
                                  >
                                    <span className="text-sm font-medium text-foreground">
                                      {withPartNumber(
                                        item.name,
                                        item.partNumber,
                                        item.model
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      <span className="font-mono">{item.sku}</span>
                                      {item.brand ? ` · ${item.brand}` : ""}
                                      {" · "}
                                      {item.quantity} {item.unit}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {itemOptions.map((item) => {
                        const active = item.id === itemId;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              disabled={!canWrite}
                              onClick={() => {
                                setItemId(item.id);
                                setItemQuery(item.sku);
                                setScanHint("");
                              }}
                              className={cn(
                                "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted/60",
                                active && "bg-[#00BFFF]/10"
                              )}
                            >
                              <span className="text-sm font-medium text-foreground">
                                {withPartNumber(
                                  item.name,
                                  item.partNumber,
                                  item.model
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <span className="font-mono">{item.sku}</span>
                                {" · "}
                                {categoryLabel(item)}
                                {item.brand ? ` · ${item.brand}` : ""}
                                {" · "}
                                {item.quantity} {item.unit}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {!hasCatalogFilters && items.length > 60 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Mostrando 60 de {items.length}. Filtra o escribe para ver el
                    resto.
                  </p>
                ) : null}

            {selected ? (
              <div className="grid gap-4 rounded-xl border border-dashed border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">
                  Detalle para agregar · {selected.sku}
                </p>
                {!isEquipmentCatalog ? (
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium"><Ui>Cantidad</Ui></span>
                    <input
                      ref={quantityRef}
                      required={lines.length === 0}
                      type="number"
                      min={1}
                      value={quantity}
                      disabled={!canWrite}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                      className={fieldClass}
                    />
                  </label>
                ) : mode === "entrada" ? (
                  <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Cada línea de serie es una pieza. La cantidad es el número de
                    series capturadas.
                  </p>
                ) : (
                  <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Las salidas de equipo se registran de 1 en 1, indicando la serie.
                  </p>
                )}

                {!isEquipmentCatalog ? (
                  mode === "salida" && lots.length > 0 ? (
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium"><Ui>Lote (FEFO)</Ui></span>
                      <select
                        value={lotNumber}
                        disabled={!canWrite}
                        onChange={(event) => {
                          const lot = lots.find(
                            (item) => item.lotNumber === event.target.value
                          );
                          setLotNumber(event.target.value);
                          setExpiryDate(lot?.expiryDate ?? "");
                          setManufacturedAt(lot?.manufacturedAt ?? "");
                        }}
                        className={fieldClass}
                      >
                        <option value="">Sin lote / automático</option>
                        {lots.map((lot) => (
                          <option key={lot.id} value={lot.lotNumber}>
                            {lotSelectLabel(lot, unitLabel, Boolean(warehouseId))}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {lots.length > 0 ? (
                        <label className="space-y-1.5 sm:col-span-2">
                          <span className="text-sm font-medium"><Ui>Lote existente</Ui></span>
                          <select
                            value={selectedLot?.lotNumber ?? ""}
                            disabled={!canWrite}
                            onChange={(event) => {
                              const value = event.target.value;
                              const lot = lots.find((item) => item.lotNumber === value);
                              setLotNumber(value);
                              setExpiryDate(lot?.expiryDate ?? "");
                              setManufacturedAt(lot?.manufacturedAt ?? "");
                            }}
                            className={fieldClass}
                          >
                            <option value="">Nuevo lote…</option>
                            {lots.map((lot) => (
                              <option key={lot.id} value={lot.lotNumber}>
                                {lotSelectLabel(lot, unitLabel, Boolean(warehouseId))}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {selectedLot ? null : (
                        <label className="space-y-1.5">
                          <span className="text-sm font-medium">
                            Lote
                            {selected.tracksLot ? " (obligatorio)" : ""}
                          </span>
                          <input
                            ref={lotRef}
                            value={lotNumber}
                            disabled={!canWrite}
                            required={
                              lines.length === 0 &&
                              Boolean(selected.tracksLot && mode === "entrada")
                            }
                            onChange={(event) => setLotNumber(event.target.value)}
                            placeholder={
                              lots.length > 0 ? "Número del lote nuevo" : undefined
                            }
                            className={fieldClass}
                          />
                        </label>
                      )}
                      <label className="space-y-1.5">
                        <span className="text-sm font-medium"><Ui>Fecha de fabricación (opcional)</Ui></span>
                        <input
                          type="date"
                          value={manufacturedAt}
                          disabled={!canWrite}
                          onChange={(event) => setManufacturedAt(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-medium"><Ui>Caducidad (opcional)</Ui></span>
                        <input
                          type="date"
                          value={expiryDate}
                          disabled={!canWrite}
                          onChange={(event) => setExpiryDate(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                    </div>
                  )
                ) : null}

                {isEquipmentCatalog && mode === "entrada" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-sm font-medium">
                        Números de serie (obligatorio)
                      </span>
                      <textarea
                        ref={serialAreaRef}
                        value={serialNumber}
                        disabled={!canWrite}
                        required={lines.length === 0}
                        rows={4}
                        placeholder={"Una serie por línea\nSN-001\nSN-002"}
                        onChange={(event) => setSerialNumber(event.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium"><Ui>Fecha de fabricación (opcional)</Ui></span>
                      <input
                        type="date"
                        value={manufacturedAt}
                        disabled={!canWrite}
                        onChange={(event) => setManufacturedAt(event.target.value)}
                        className={fieldClass}
                      />
                      <span className="block text-xs text-muted-foreground">
                        Se guarda en cada serie registrada en esta entrada.
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">
                        Número de serie
                        {selected.tracksSerial || isEquipmentCatalog
                          ? " (obligatorio)"
                          : ""}
                      </span>
                      <input
                        ref={serialInputRef}
                        value={serialNumber}
                        disabled={!canWrite}
                        required={
                          lines.length === 0 &&
                          Boolean(selected.tracksSerial || isEquipmentCatalog)
                        }
                        onChange={(event) => setSerialNumber(event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    {isEquipmentCatalog ? (
                      <label className="space-y-1.5">
                        <span className="text-sm font-medium"><Ui>Fecha de fabricación (opcional)</Ui></span>
                        <input
                          type="date"
                          value={manufacturedAt}
                          disabled={!canWrite}
                          onChange={(event) =>
                            setManufacturedAt(event.target.value)
                          }
                          className={fieldClass}
                        />
                      </label>
                    ) : null}
                  </div>
                )}

                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addDraftToLines}
                      className="border-[#00BFFF]/40"
                    >
                      <Plus className="size-4" />
                      Agregar a la lista
                    </Button>
                    <span className="self-center text-xs text-muted-foreground">
                      O escanea el siguiente producto para seguir acumulando.
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Elige un artículo del catálogo o escanea un código para capturar
                cantidad, lote o serie.
              </p>
            )}
              </div>

              {/* Derecha: listado ya escaneado */}
              <div className="space-y-3 rounded-xl border border-[#00BFFF]/25 bg-muted/10 p-3 lg:min-h-[28rem]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Escaneados ({lines.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Equipos y productos listos para esta{" "}
                      {mode === "entrada" ? "entrada" : "salida"}.
                    </p>
                  </div>
                  {lines.length > 0 ? (
                    <button
                      type="button"
                      disabled={!canWrite || submitting}
                      onClick={() => {
                        setLines([]);
                        setScanHint("Lista vaciada. Escanea de nuevo.");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Vaciar
                    </button>
                  ) : null}
                </div>
                {lines.length === 0 ? (
                  <div className="flex min-h-[16rem] flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center lg:min-h-[22rem]">
                    <p className="text-sm text-muted-foreground">
                      Escanea o busca a la izquierda. Aquí aparecerán los
                      productos y equipos ya añadidos.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[36rem] overflow-auto rounded-lg border border-border bg-background">
                    <SortableTable className="w-full min-w-[32rem] border-collapse text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-border bg-muted/60 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Referencia</th>
                          <th className="px-3 py-2 font-medium">Producto</th>
                          <th className="px-3 py-2 font-medium">Detalle</th>
                          <th className="px-3 py-2 font-medium">Ubicación</th>
                          <th className="px-3 py-2 font-medium">Cant.</th>
                          <th className="px-2 py-2 font-medium" data-sort="off">
                            <span className="sr-only">Quitar</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => {
                          const locationName =
                            locations.find((row) => row.id === line.locationId)
                              ?.name ?? "";
                          const detailSort = [
                            line.lotNumber,
                            line.serialNumber,
                            line.manufacturedAt,
                            line.expiryDate,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                          <tr
                            key={line.key}
                            className="border-b border-border last:border-0"
                          >
                            <td
                              className="max-w-[10rem] px-3 py-2 align-middle"
                              data-sort={
                                line.partNumber.trim() ||
                                line.model.trim() ||
                                line.sku
                              }
                            >
                              <span className="inline-flex max-w-full items-center rounded-md bg-[#00BFFF]/12 px-2 py-1 font-mono text-sm font-bold tracking-tight text-foreground ring-1 ring-[#00BFFF]/25">
                                {line.partNumber.trim() || "Sin ref."}
                              </span>
                              {line.model.trim() ? (
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  {catalogModelLabel(line.model)}
                                </span>
                              ) : null}
                            </td>
                            <td
                              className="max-w-[11rem] px-3 py-2 align-middle"
                              data-sort={`${line.name} ${line.sku}`}
                            >
                              <span className="line-clamp-2 font-medium">
                                {line.name}
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                                {line.sku}
                                {line.partNumber.trim()
                                  ? ` · ref. ${line.partNumber.trim()}`
                                  : ""}
                              </span>
                            </td>
                            <td
                              className="px-3 py-2 align-middle text-xs text-muted-foreground"
                              data-sort={detailSort || "—"}
                            >
                              {[
                                line.lotNumber ? `Lote ${line.lotNumber}` : "",
                                line.serialNumber
                                  ? `Serie ${line.serialNumber}`
                                  : "",
                                line.manufacturedAt
                                  ? `Fab. ${line.manufacturedAt}`
                                  : "",
                                line.expiryDate
                                  ? `Cad. ${line.expiryDate}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </td>
                            <td
                              className="px-3 py-2 align-middle"
                              data-sort={locationName || "zzzz"}
                            >
                              <div className="space-y-1">
                                <select
                                  value={line.locationId}
                                  disabled={!canWrite || submitting || !warehouseId}
                                  onChange={(event) => {
                                    const nextLocationId = event.target.value;
                                    setLines((current) =>
                                      current.map((row) =>
                                        row.key === line.key
                                          ? { ...row, locationId: nextLocationId }
                                          : row
                                      )
                                    );
                                  }}
                                  className="h-8 max-w-[12rem] rounded-md border border-input bg-background px-2 text-xs"
                                  aria-label={`Ubicación ${line.sku}`}
                                >
                                  <option value="">
                                    {line.locationId
                                      ? "Elegir…"
                                      : "Sin ubicación registrada"}
                                  </option>
                                  {physicalLocations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                  {genericLocations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                                {mode === "entrada" ? (
                                  <div className="flex max-w-[14rem] items-center gap-1">
                                    <input
                                      value={locationDrafts[line.key] ?? ""}
                                      onChange={(event) =>
                                        setLocationDrafts((current) => ({
                                          ...current,
                                          [line.key]: event.target.value,
                                        }))
                                      }
                                      placeholder={
                                        line.locationId
                                          ? "Escribir otra ubicación"
                                          : "Escribe la ubicación"
                                      }
                                      disabled={!canWrite || creatingLocation}
                                      className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                                      aria-label={`Nueva ubicación ${line.sku}`}
                                      onKeyDown={(event) => {
                                        if (event.key !== "Enter") return;
                                        event.preventDefault();
                                        void handleCreateLocation(
                                          locationDrafts[line.key] ?? "",
                                          line.key
                                        );
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="h-8 px-2 text-xs"
                                      disabled={
                                        !canWrite ||
                                        creatingLocation ||
                                        !(locationDrafts[line.key] ?? "").trim()
                                      }
                                      onClick={() =>
                                        void handleCreateLocation(
                                          locationDrafts[line.key] ?? "",
                                          line.key
                                        )
                                      }
                                    >
                                      Usar
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td
                              className="px-3 py-2 align-middle whitespace-nowrap"
                              data-sort={line.isEquipment ? 1 : line.quantity}
                            >
                              {line.isEquipment ? (
                                <span className="text-xs text-muted-foreground">
                                  1 {line.unit}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    value={line.quantity}
                                    disabled={!canWrite || submitting}
                                    onChange={(event) => {
                                      const value = Number(event.target.value);
                                      setLines((current) =>
                                        current.map((row) =>
                                          row.key === line.key
                                            ? {
                                                ...row,
                                                quantity: value > 0 ? value : 1,
                                              }
                                            : row
                                        )
                                      );
                                    }}
                                    className="h-8 w-14 rounded-md border border-input bg-background px-2 text-sm"
                                    aria-label={`Cantidad ${line.sku}`}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {line.unit}
                                  </span>
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 align-middle" data-sort="off">
                              <button
                                type="button"
                                disabled={!canWrite || submitting}
                                onClick={() =>
                                  setLines((current) =>
                                    current.filter((row) => row.key !== line.key)
                                  )
                                }
                                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                                aria-label={`Quitar ${line.sku}`}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </SortableTable>
                  </div>
                )}
              </div>
            </div>

            {showServiceFields ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium"><Ui>Técnico</Ui></span>
                  <input
                    value={technician}
                    disabled={!canWrite}
                    onChange={(event) => setTechnician(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">
                    Serie del equipo relacionado
                  </span>
                  <input
                    value={relatedSerial}
                    disabled={!canWrite}
                    onChange={(event) => setRelatedSerial(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>
            ) : null}

            <label className="space-y-1.5">
              <span className="text-sm font-medium"><Ui>Nota (opcional)</Ui></span>
              <textarea
                rows={2}
                value={note}
                disabled={!canWrite}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Motivo, orden de compra, área que solicita..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
              />
            </label>

            {requiresEvidence ? (
              <div className="space-y-2 rounded-xl border border-dashed border-[#3B46A5]/40 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium"><Ui>Fotos de evidencia (opcional)</Ui></p>
                    <p className="text-xs text-muted-foreground">
                      Si las agregas, se guardan en el movimiento y en las fotos de la serie, del
                      lote o del producto recibido.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CameraButton
                      multiple
                      size="default"
                      title="Fotos de evidencia"
                      disabled={!canWrite || submitting}
                      className="h-auto py-1.5"
                      onCapture={(files) => setEvidenceFiles((current) => [...current, ...files])}
                    />
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted",
                        (!canWrite || submitting) && "pointer-events-none opacity-60"
                      )}
                    >
                      <ImagePlus className="size-4" />
                      {evidenceFiles.length ? "Agregar más" : "Elegir fotos"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        disabled={!canWrite || submitting}
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []).filter((file) =>
                            file.type.startsWith("image/")
                          );
                          event.target.value = "";
                          if (files.length) setEvidenceFiles((current) => [...current, ...files]);
                        }}
                      />
                    </label>
                  </div>
                </div>
                {evidenceFiles.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {evidencePreviews.map((url, index) => (
                      <div
                        key={url}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-border"
                      >
                        <button
                          type="button"
                          className="block size-full"
                          onClick={() =>
                            setEvidenceViewer({
                              images: evidencePreviews.map((src, i) => ({
                                src,
                                caption: `Evidencia ${i + 1} · ${evidenceFiles[i]?.name ?? ""}`,
                              })),
                              index,
                            })
                          }
                          aria-label={`Ver evidencia ${index + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="size-full object-cover" />
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            setEvidenceFiles((current) => current.filter((_, i) => i !== index))
                          }
                          className="absolute right-1 top-1 rounded-full bg-red-500/85 p-1 text-white hover:bg-red-500 disabled:opacity-50"
                          title="Quitar foto"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin fotos por ahora. Puedes adjuntar factura, empaque o etiqueta si las tienes.
                  </p>
                )}
              </div>
            ) : null}

            {selected ? (
              <p className="text-sm text-muted-foreground">
                {isEquipmentCatalog ? "Existencia actual: " : "Stock actual: "}
                <span className="font-medium text-foreground">
                  {selected.quantity} {selected.unit}
                </span>
                {isEquipmentCatalog && selected.assetStatus
                  ? ` · estado ${selected.assetStatus}`
                  : null}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  {message}
                </p>
                {lastFolios.length > 0 ? (
                  <MovementVoucherActions
                    records={async () => {
                      const { getMovementsByFolio } = await import(
                        "@/lib/warehouse/movements"
                      );
                      return getMovementsByFolio(lastFolios);
                    }}
                    warehouses={warehouses}
                    variant="button"
                    onError={setError}
                  />
                ) : null}
              </div>
            ) : null}

            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={printOnSave}
                onChange={(event) => setPrintOnSave(event.target.checked)}
                className="size-3.5 rounded border-input"
              />
              {mode === "entrada"
                ? "Imprimir vale de entrada al registrar"
                : "Imprimir vale de salida al registrar"}
            </label>

            <Button
              ref={submitRef}
              type="submit"
              disabled={
                !canWrite ||
                submitting ||
                items.length === 0 ||
                (lines.length === 0 && !selected)
              }
              className="w-fit border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
            >
              {submitting
                ? "Guardando..."
                : lines.length > 1
                  ? mode === "entrada"
                    ? `Registrar entrada · ${lines.length} productos`
                    : `Registrar salida · ${lines.length} productos`
                  : mode === "entrada"
                    ? isEquipmentCatalog
                      ? "Registrar entrada de equipo"
                      : "Registrar entrada"
                    : isEquipmentCatalog
                      ? "Registrar salida de equipo"
                      : "Registrar salida"}
            </Button>
          </form>
        </section>

        {showHistory ? (
        <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Historial de {mode === "entrada" ? "entradas" : "salidas"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Últimos movimientos registrados en esta pantalla.
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void loadHistory()}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Ocultar
              </button>
            </div>
          </div>
          {canSwitchModes ? (
            <div className="mt-3 lg:hidden">
              <ModeSwitch mode={mode} onChange={switchMode} />
            </div>
          ) : null}

          <SearchInput
            value={historyQuery}
            onChange={setHistoryQuery}
            placeholder="Buscar folio, artículo, n.º de parte o motivo..."
            scanSearch="off"
            className="mt-3"
          />

          <div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">Cargando historial...</p>
            ) : visibleHistory.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {historyQuery.trim()
                  ? "Ningún movimiento coincide con la búsqueda."
                  : `Aún no hay ${mode === "entrada" ? "entradas" : "salidas"} registradas.`}
              </p>
            ) : (
              visibleHistory.map((row) => {
                const qty =
                  mode === "entrada"
                    ? row.qtyIn || row.resultingQty
                    : row.qtyOut || row.resultingQty;
                return (
                  <article
                    key={row.id}
                    className="rounded-xl border border-border/80 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.productSku} — {withPartNumber(row.productName, row.partNumber, row.productModel)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.folio}
                          {row.reason ? ` · ${row.reason}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {row.folio ? (
                          <MovementVoucherActions
                            records={async () => {
                              const { getMovementsByFolio } = await import(
                                "@/lib/warehouse/movements"
                              );
                              return getMovementsByFolio([row.folio]);
                            }}
                            warehouses={warehouses}
                            variant="icon"
                            onError={setError}
                          />
                        ) : null}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            mode === "entrada"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                          )}
                        >
                          {mode === "entrada" ? "+" : "−"}
                          {qty}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {new Date(row.occurredAt).toLocaleString("es-MX", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <span>Stock: {row.resultingQty}</span>
                      {row.createdBy ? <span>@{row.createdBy}</span> : null}
                    </div>
                    {row.note ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                        {row.note}
                      </p>
                    ) : null}
                    {row.evidenceImages.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {row.evidenceImages.map((image, index) => (
                          <button
                            key={image.path}
                            type="button"
                            className="size-10 overflow-hidden rounded-md border border-border hover:opacity-85"
                            onClick={() =>
                              setEvidenceViewer({
                                images: row.evidenceImages.map((evidence, i) => ({
                                  src: evidence.url,
                                  caption: `${row.folio} · evidencia ${i + 1}`,
                                })),
                                index,
                              })
                            }
                            aria-label={`Ver evidencia ${index + 1} de ${row.folio}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image.url} alt="" className="size-full object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </aside>
        ) : null}
      </div>

      {evidenceViewer && evidenceViewer.images[evidenceViewer.index] ? (
        <ImageLightbox
          images={evidenceViewer.images}
          index={evidenceViewer.index}
          onClose={() => setEvidenceViewer(null)}
          onIndexChange={(index) =>
            setEvidenceViewer((current) => (current ? { ...current, index } : current))
          }
        />
      ) : null}

      {equipmentFormOpen && canWrite ? (
        <ModalShell
          title="Dar de alta equipo"
          description="Da de alta el modelo (sin serie). Después captura las series en el registro de entradas."
        >
          {creatingEquipment ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Guardando equipo...
            </p>
          ) : null}
          {error ? (
            <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <InventoryForm
            itemKind="equipo"
            canViewPrices={access.can("precios.view")}
            canEditPrices={access.can("precios.edit")}
            onSubmit={handleCreateEquipment}
            onCancel={() => {
              if (!creatingEquipment) setEquipmentFormOpen(false);
            }}
          />
        </ModalShell>
      ) : null}
    </>
  );
}
