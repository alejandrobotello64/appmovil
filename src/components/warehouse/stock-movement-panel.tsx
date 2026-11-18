"use client";

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
  History,
  ImagePlus,
  Plus,
  ScanBarcode,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraButton } from "@/components/media/camera-capture";
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
  getEntryExitHistory,
  getProductLots,
  getProductWarehouseQuantities,
  getWarehouseLocations,
  getWarehouses,
  type KardexRow,
  type ProductLot,
  type Warehouse,
  type WarehouseLocation,
  type WarehouseStock,
} from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { parseSerialNumbers } from "@/lib/inventory/serials";
import type { ScanMatch, ScanResult } from "@/lib/scan/lookup";
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
    if (!warehouseId) return;
    void getWarehouseLocations(warehouseId)
      .then((rows) => {
        setLocations(rows);
        const fallback = rows[0]?.id ?? "";
        setLocationId((current) =>
          rows.some((row) => row.id === current) ? current : fallback
        );
        // Si cambió el almacén, reasigna ubicaciones inválidas de líneas ya agregadas.
        setLines((current) =>
          current.map((line) =>
            rows.some((row) => row.id === line.locationId)
              ? line
              : { ...line, locationId: fallback }
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
  const [historyQuery, setHistoryQuery] = useState("");
  const [scanHint, setScanHint] = useState("");
  /** Al escanear, agrega directo a la lista multi-producto. */
  const [autoAddOnScan, setAutoAddOnScan] = useState(true);
  const [lines, setLines] = useState<StockMovementLine[]>([]);
  /** Historial oculto por defecto para dejar espacio al formulario. */
  const [showHistory, setShowHistory] = useState(false);
  const quantityRef = useRef<HTMLInputElement>(null);
  const lotRef = useRef<HTMLInputElement>(null);
  const serialInputRef = useRef<HTMLInputElement>(null);
  const serialAreaRef = useRef<HTMLTextAreaElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const clearDraft = useCallback(() => {
    setItemId("");
    setItemQuery("");
    setQuantity(1);
    setLotNumber("");
    setExpiryDate("");
    setManufacturedAt("");
    setSerialNumber("");
  }, []);
  const itemOptions = useMemo(() => {
    const filtered = items.filter(
      (item) =>
        item.id === itemId ||
        !itemQuery.trim() ||
        matchesSearch(itemQuery, articleFields(item))
    );
    // Sin búsqueda: muestra un recorte del catálogo para no saturar.
    if (!itemQuery.trim()) return filtered.slice(0, 60);
    return filtered.slice(0, 80);
  }, [items, itemQuery, itemId]);

  const applyScanMatch = useCallback(
    ({ match, result }: { match: ScanMatch | null; result: ScanResult }) => {
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
          locationId,
        });
        setLines((current) => mergeMovementLine(current, next));
        clearDraft();
        setScanHint(
          `Agregado: ${local.sku}.${ambiguous} Escanea el siguiente o confirma la lista.`
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
        lot ? `lote ${lot}` : "",
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
    [equipmentFormOpen, items, mode, autoAddOnScan, clearDraft, locationId]
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
    setWarehouseId((current) =>
      stockedWarehouses.some((warehouse) => warehouse.id === current)
        ? current
        : stockedWarehouses[0].id
    );
  }, [stockedWarehouses, mode]);

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

  function buildLinesFromDraft(): StockMovementLine[] {
    if (!selected) return [];
    const isEquip = isEquipmentCatalog;
    if (isEquip && mode === "entrada") {
      const serials = parseSerialNumbers(serialNumber);
      return serials.map((serial) =>
        lineFromProduct(selected, {
          quantity: 1,
          serialNumber: serial,
          manufacturedAt,
          locationId,
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
        locationId,
      }),
    ];
  }

  function addDraftToLines() {
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
      const built = buildLinesFromDraft();
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
        pending = buildLinesFromDraft();
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
        });
        results.push({
          ...movement,
          productId: line.productId,
          unit: line.unit,
        });
      }

      const folios = results.map((item) => item.folio);
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
            `Se registraron ${folios.join(", ")}, pero no se pudo guardar la evidencia: ${
              evidenceError instanceof Error
                ? evidenceError.message
                : "error desconocido"
            }`
          );
        }
      }

      const label =
        mode === "entrada"
          ? pending.length > 1
            ? `${pending.length} entradas: ${folios.join(", ")}.`
            : `Entrada ${folios[0]}.`
          : pending.length > 1
            ? `${pending.length} salidas: ${folios.join(", ")}.`
            : `Salida ${folios[0]}.`;
      setMessage(`${label}${evidenceNote}`);
      setLines([]);
      clearDraft();
      setNote("");
      setTechnician("");
      setRelatedSerial("");
      setScanHint("Listo: escanea el siguiente lote de productos.");
      await Promise.all([loadHistory(), loadLots(), loadWarehouseStock()]);
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
                    ? "Escanea varios productos a la lista, revisa cantidades y confirma todo de una vez. Con GS1 se rellenan lote/serie/caducidad."
                    : "Escanea varios productos a la lista, revisa cantidades y confirma la salida en un solo paso."}
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
                    <Plus className="size-4" />
                    Dar de alta equipo
                  </Button>
                ) : null}
              </div>
            </div>
            {canSwitchModes ? (
              <ModeSwitch mode={mode} onChange={switchMode} />
            ) : null}
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#00BFFF]/35 bg-[#00BFFF]/5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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
                    "Escanea para ir agregando productos. Si es GS1, lote/serie/caducidad se cargan solos."}
                </p>
              </div>
            </div>
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

          <div className="mt-4">
            <ReadOnlyBanner visible={!canWrite} />
          </div>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Tipo de registro</span>
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
                    <span className="text-sm font-medium">Almacén</span>
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
                    ) : mode === "entrada" &&
                      warehouseStock !== null &&
                      warehouseStock.length === 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        Este artículo aún no tiene existencia; elige el almacén
                        de la entrada.
                      </span>
                    ) : null}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">
                      Ubicación por defecto
                    </span>
                    <select
                      value={locationId}
                      onChange={(event) => setLocationId(event.target.value)}
                      disabled={!canWrite}
                      className={fieldClass}
                    >
                      {locations.length === 0 ? (
                        <option value="">Sin ubicaciones</option>
                      ) : (
                        locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.code} — {location.name}
                          </option>
                        ))
                      )}
                    </select>
                    <span className="block text-xs text-muted-foreground">
                      Se aplica a productos nuevos; cámbiala por línea a la
                      derecha.
                    </span>
                  </label>
                </div>

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
                  <SearchInput
                    value={itemQuery}
                    onChange={(value) => {
                      setItemQuery(value);
                      setScanHint("");
                      const first = items.find((item) =>
                        matchesSearch(value, articleFields(item))
                      );
                      if (value.trim() && first) setItemId(first.id);
                      else if (!value.trim()) setItemId("");
                    }}
                    scanSearch="true"
                    placeholder="Buscar o escanear por código, nombre, n.º de parte..."
                  />
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
                      Sin coincidencias. Prueba otro término.
                    </p>
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
                                {withPartNumber(item.name, item.partNumber, item.model)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                <span className="font-mono">{item.sku}</span>
                                {" · "}
                                {categoryLabel(item)}
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
                {!itemQuery.trim() && items.length > 60 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Mostrando 60 de {items.length}. Escribe para filtrar el resto.
                  </p>
                ) : null}

            {selected ? (
              <div className="grid gap-4 rounded-xl border border-dashed border-border bg-background p-3">
                <p className="text-sm font-medium text-foreground">
                  Detalle para agregar · {selected.sku}
                </p>
                {!isEquipmentCatalog ? (
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Cantidad</span>
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
                      <span className="text-sm font-medium">Lote (FEFO)</span>
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
                          <span className="text-sm font-medium">Lote existente</span>
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
                        <span className="text-sm font-medium">
                          Fecha de fabricación (opcional)
                        </span>
                        <input
                          type="date"
                          value={manufacturedAt}
                          disabled={!canWrite}
                          onChange={(event) => setManufacturedAt(event.target.value)}
                          className={fieldClass}
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-sm font-medium">Caducidad (opcional)</span>
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
                      <span className="text-sm font-medium">
                        Fecha de fabricación (opcional)
                      </span>
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
                        <span className="text-sm font-medium">
                          Fecha de fabricación (opcional)
                        </span>
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
                    <table className="w-full min-w-[32rem] border-collapse text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-border bg-muted/60 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Ref.</th>
                          <th className="px-3 py-2 font-medium">Producto</th>
                          <th className="px-3 py-2 font-medium">Detalle</th>
                          <th className="px-3 py-2 font-medium">Ubicación</th>
                          <th className="px-3 py-2 font-medium">Cant.</th>
                          <th className="px-2 py-2 font-medium">
                            <span className="sr-only">Quitar</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <tr
                            key={line.key}
                            className="border-b border-border last:border-0"
                          >
                            <td className="max-w-[9rem] px-3 py-2 align-middle">
                              <span className="block font-mono text-xs font-semibold tracking-tight text-foreground">
                                {line.partNumber.trim() || "—"}
                              </span>
                              {line.model.trim() ? (
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                  {catalogModelLabel(line.model)}
                                </span>
                              ) : null}
                            </td>
                            <td className="max-w-[10rem] px-3 py-2 align-middle">
                              <span className="line-clamp-2 font-medium">
                                {line.name}
                              </span>
                              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                                {line.sku}
                              </span>
                            </td>
                            <td className="px-3 py-2 align-middle text-xs text-muted-foreground">
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
                            <td className="px-3 py-2 align-middle">
                              <select
                                value={line.locationId}
                                disabled={!canWrite || submitting || locations.length === 0}
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
                                className="h-8 max-w-[10rem] rounded-md border border-input bg-background px-2 text-xs"
                                aria-label={`Ubicación ${line.sku}`}
                              >
                                {locations.length === 0 ? (
                                  <option value="">Sin ubicaciones</option>
                                ) : (
                                  <>
                                    {!locations.some((loc) => loc.id === line.locationId) ? (
                                      <option value={line.locationId || ""}>
                                        {line.locationId ? "Ubicación anterior" : "Elegir…"}
                                      </option>
                                    ) : null}
                                    {locations.map((location) => (
                                      <option key={location.id} value={location.id}>
                                        {location.code} — {location.name}
                                      </option>
                                    ))}
                                  </>
                                )}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-middle whitespace-nowrap">
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
                            <td className="px-2 py-2 align-middle">
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {showServiceFields ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Técnico</span>
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
              <span className="text-sm font-medium">Nota (opcional)</span>
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
                    <p className="text-sm font-medium">Fotos de evidencia (opcional)</p>
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
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {message}
              </p>
            ) : null}

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
                    ? `Registrar ${lines.length} entradas`
                    : `Registrar ${lines.length} salidas`
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
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                          mode === "entrada"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/10 text-amber-800 dark:text-amber-200"
                        )}
                      >
                        {mode === "entrada" ? "+" : "−"}
                        {qty}
                      </span>
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
