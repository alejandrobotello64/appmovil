"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Camera, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox, type LightboxImage } from "@/components/ui/image-lightbox";
import { ModalShell } from "@/components/ui/modal-shell";
import { attachEntryEvidence } from "@/lib/warehouse/entry-evidence";
import { matchesSearch } from "@/lib/search";
import { InventoryForm } from "@/components/inventory/inventory-form";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import {
  createInventoryItem,
  getEquipmentItems,
  getSupplyItemsByCategory,
} from "@/lib/inventory/storage";
import type {
  InventoryItem,
  InventoryItemInput,
  SupplyCategoryId,
} from "@/lib/inventory/types";
import { SUPPLY_CATEGORIES } from "@/lib/inventory/types";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  ENTRY_REASONS,
  ISSUE_REASONS,
  isServiceIssue,
} from "@/lib/warehouse/reasons";
import {
  getEntryExitHistory,
  getProductLots,
  getWarehouseLocations,
  getWarehouses,
  type KardexRow,
  type ProductLot,
  type Warehouse,
  type WarehouseLocation,
} from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { parseSerialNumbers } from "@/lib/inventory/serials";

type StockMovementPanelProps = {
  mode: "entrada" | "salida";
};

type CatalogKind = SupplyCategoryId | "equipos";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

function articleFields(item: InventoryItem) {
  return [item.sku, item.name, item.brand, item.model, item.serialNumber, item.partNumber];
}

function withPartNumber(name: string, partNumber: string) {
  const part = partNumber.trim();
  return part ? `${name} · n.º ${part}` : name;
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
  const { canWrite } = usePermissions(mode === "entrada" ? "entradas" : "salidas");
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("insumos");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
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

  const isEquipmentCatalog = catalogKind === "equipos";
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

  async function loadCatalog(kind: CatalogKind) {
    const data =
      kind === "equipos"
        ? await getEquipmentItems()
        : await getSupplyItemsByCategory(kind);
    setItems(data);
    setItemId((current) =>
      data.some((item) => item.id === current) ? current : data[0]?.id ?? ""
    );
    return data;
  }

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadCatalog(catalogKind), getWarehouses(), loadHistory()])
      .then(([, warehouseList]) => {
        setWarehouses(warehouseList);
        const defaultWarehouse =
          warehouseList.find((item) => item.isDefault) ?? warehouseList[0];
        if (defaultWarehouse) setWarehouseId(defaultWarehouse.id);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el inventario."
        );
      })
      .finally(() => setLoading(false));
  }, [catalogKind, loadHistory]);

  useEffect(() => {
    if (!warehouseId) return;
    void getWarehouseLocations(warehouseId)
      .then((rows) => {
        setLocations(rows);
        setLocationId((current) =>
          rows.some((row) => row.id === current) ? current : rows[0]?.id ?? ""
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
  const selectedLot = useMemo(
    () => lots.find((lot) => lot.lotNumber === lotNumber) ?? null,
    [lots, lotNumber]
  );
  const unitLabel = selected?.unit || "pza";

  const [itemQuery, setItemQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const itemOptions = useMemo(
    () =>
      items.filter(
        (item) =>
          item.id === itemId ||
          matchesSearch(itemQuery, articleFields(item))
      ),
    [items, itemQuery, itemId]
  );
  const visibleHistory = useMemo(
    () =>
      history.filter((row) =>
        matchesSearch(historyQuery, [
          row.folio,
          row.productSku,
          row.productName,
          row.partNumber,
          row.reason,
          row.note,
          row.createdBy,
        ])
      ),
    [history, historyQuery]
  );

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
      setCatalogKind("equipos");
      const next = await loadCatalog("equipos");
      if (!next.some((item) => item.id === created.id)) {
        setItems([created, ...next]);
      }
      setItemId(created.id);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canWrite) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const session = getSession();
      if (!session?.username) {
        throw new Error("Inicia sesión para registrar el movimiento.");
      }
      if (mode === "entrada" && selected.tracksLot && !lotNumber.trim()) {
        throw new Error("Este producto exige número de lote.");
      }

      const serials =
        isEquipmentCatalog && mode === "entrada"
          ? parseSerialNumbers(serialNumber)
          : serialNumber.trim()
            ? [serialNumber.trim()]
            : [];
      if (isEquipmentCatalog && mode === "entrada" && serials.length === 0) {
        throw new Error(
          "Captura al menos un número de serie. Una línea por pieza."
        );
      }
      if (selected.tracksSerial && !(isEquipmentCatalog && mode === "entrada") && serials.length === 0) {
        throw new Error(
          isEquipmentCatalog
            ? "Indica el número de serie de la pieza que sale."
            : "Este producto exige número de serie."
        );
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
      const movementBase = {
        productId: selected.id,
        movementType: mode,
        createdBy: session.username,
        note: extraNote,
        reason: reasonLabel,
        warehouseId: warehouseId || null,
        locationId: locationId || null,
        lotNumber: isEquipmentCatalog ? null : lotNumber || null,
        expiryDate: isEquipmentCatalog ? null : expiryDate || null,
        manufacturedAt: manufacturedAt || null,
      } as const;

      const results: Array<{
        folio: string;
        movementId: string;
        newQuantity: number;
      }> = [];
      if (isEquipmentCatalog && mode === "entrada") {
        for (const serial of serials) {
          results.push(
            await applyStockMovement({
              ...movementBase,
              quantity: 1,
              serialNumber: serial,
            })
          );
        }
      } else {
        results.push(
          await applyStockMovement({
            ...movementBase,
            quantity: isEquipmentCatalog ? 1 : quantity,
            serialNumber: serials[0] ?? null,
          })
        );
      }
      const result = results[results.length - 1];
      const folios = results.map((item) => item.folio);
      const updated = {
        ...selected,
        quantity: result.newQuantity,
      };

      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );

      let evidenceNote = "";
      if (requiresEvidence && evidenceFiles.length > 0) {
        try {
          let lastTarget: "serie" | "lote" | "producto" = "producto";
          for (const movement of results) {
            const evidence = await attachEntryEvidence(
              movement.movementId,
              evidenceFiles
            );
            lastTarget = evidence.target;
          }
          const targetLabel =
            lastTarget === "serie"
              ? serials.length > 1
                ? "las series"
                : "la serie"
              : lastTarget === "lote"
                ? "el lote"
                : "el producto";
          evidenceNote = ` Evidencia integrada a ${targetLabel}.`;
          setEvidenceFiles([]);
        } catch (evidenceError) {
          setError(
            `La entrada ${folios.join(", ")} se registró, pero no se pudo guardar la evidencia: ${
              evidenceError instanceof Error ? evidenceError.message : "error desconocido"
            }`
          );
        }
      }

      const folioLabel =
        folios.length > 1 ? `Entradas ${folios.join(", ")}` : `Entrada ${result.folio}`;
      setMessage(
        mode === "entrada"
          ? `${folioLabel}. Nuevo stock: ${updated.quantity} ${updated.unit}.${evidenceNote}`
          : `Salida ${result.folio}. Nuevo stock: ${updated.quantity} ${updated.unit}.`
      );
      setQuantity(1);
      setNote("");
      setTechnician("");
      setRelatedSerial("");
      if (mode === "entrada") {
        setLotNumber("");
        setExpiryDate("");
        setSerialNumber("");
      }
      await Promise.all([loadHistory(), loadLots()]);
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
      <p className="text-sm text-muted-foreground">
        Cargando {isEquipmentCatalog ? "equipos" : catalogKind}...
      </p>
    );
  }

  const reasons = mode === "entrada" ? ENTRY_REASONS : ISSUE_REASONS;
  const showServiceFields = mode === "salida" && isServiceIssue(reason);
  const catalogOptions = [
    ...SUPPLY_CATEGORIES.map((item) => ({ id: item.id as CatalogKind, label: item.label })),
    { id: "equipos" as const, label: "Equipos" },
  ];

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:items-start">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {mode === "entrada" ? "Registrar entrada" : "Registrar salida"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "entrada"
                  ? "Elige categoría y tipo de registro. Los equipos se dan de alta por modelo; las series se capturan aquí."
                  : "Descuenta unidades por categoría. Insumos/medicamentos/reactivos usan caducidad."}
              </p>
            </div>
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

          <div className="mt-4">
            <ReadOnlyBanner visible={!canWrite} />
          </div>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div className="grid gap-3 rounded-xl border border-border bg-muted/25 p-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Categoría</span>
                <select
                  value={catalogKind}
                  disabled={!canWrite}
                  onChange={(event) => {
                    setCatalogKind(event.target.value as CatalogKind);
                    setItemQuery("");
                    setError("");
                    setMessage("");
                  }}
                  className={fieldClass}
                >
                  {catalogOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

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
            </div>

            <div className="space-y-1.5">
              <label htmlFor="stock-movement-item" className="text-sm font-medium">
                {isEquipmentCatalog ? "Equipo" : "Artículo"}
              </label>
              {items.length > 0 ? (
                <SearchInput
                  value={itemQuery}
                  onChange={(value) => {
                    setItemQuery(value);
                    const first = items.find((item) =>
                      matchesSearch(value, articleFields(item))
                    );
                    if (value.trim() && first) setItemId(first.id);
                  }}
                  placeholder={
                    isEquipmentCatalog
                      ? "Buscar equipo por código, nombre, marca, serie o n.º de parte..."
                      : "Buscar artículo por código, nombre o n.º de parte..."
                  }
                />
              ) : null}
              <select
                id="stock-movement-item"
                required
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                disabled={!canWrite}
                className={fieldClass}
              >
                {items.length === 0 ? (
                  <option value="">
                    {isEquipmentCatalog
                      ? "No hay equipos. Da de alta uno nuevo."
                      : `No hay ${catalogKind} disponibles.`}
                  </option>
                ) : (
                  itemOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {withPartNumber(item.name, item.partNumber)} (
                      {item.quantity} {item.unit})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Almacén</span>
                <select
                  required
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  disabled={!canWrite}
                  className={fieldClass}
                >
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.code} — {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Ubicación</span>
                <select
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  disabled={!canWrite}
                  className={fieldClass}
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} — {location.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!isEquipmentCatalog ? (
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Cantidad</span>
                <input
                  required
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
                Cada línea de serie es una pieza. La cantidad de la entrada es el
                número de series capturadas.
              </p>
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Las salidas de equipo se registran de 1 en 1, indicando la serie
                de la pieza.
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
                  {selectedLot ? (
                    <span className="block text-xs text-muted-foreground">
                      {selectedLot.warehouseQuantity > 0
                        ? `Hay ${formatLotQty(selectedLot.warehouseQuantity, unitLabel)} de este lote en el almacén.`
                        : `No hay existencia de este lote en este almacén.`}
                      {selectedLot.quantity !== selectedLot.warehouseQuantity
                        ? ` Total: ${formatLotQty(selectedLot.quantity, unitLabel)}.`
                        : null}
                    </span>
                  ) : null}
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {lots.length > 0 ? (
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-sm font-medium">
                        Lote existente
                      </span>
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
                      {selectedLot ? (
                        <span className="block text-xs text-muted-foreground">
                          {selectedLot.warehouseQuantity > 0
                            ? `Este lote ya tiene ${formatLotQty(selectedLot.warehouseQuantity, unitLabel)} en el almacén seleccionado.`
                            : "Este lote no tiene existencia en el almacén seleccionado."}
                          {selectedLot.quantity !== selectedLot.warehouseQuantity
                            ? ` Total: ${formatLotQty(selectedLot.quantity, unitLabel)}.`
                            : null}
                        </span>
                      ) : (
                        <span className="block text-xs text-muted-foreground">
                          Elige un lote para ver cuántas piezas hay, o captura uno nuevo abajo.
                        </span>
                      )}
                    </label>
                  ) : null}
                  {selectedLot ? null : (
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">
                        Lote
                        {selected?.tracksLot ? " (obligatorio)" : ""}
                      </span>
                      <input
                        value={lotNumber}
                        disabled={!canWrite}
                        required={Boolean(selected?.tracksLot && mode === "entrada")}
                        onChange={(event) => setLotNumber(event.target.value)}
                        placeholder={lots.length > 0 ? "Número del lote nuevo" : undefined}
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
                    <span className="text-sm font-medium">
                      Caducidad (opcional)
                    </span>
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
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
                  Números de serie (obligatorio)
                </span>
                <textarea
                  value={serialNumber}
                  disabled={!canWrite}
                  required
                  rows={4}
                  placeholder={"Una serie por línea\nSN-001\nSN-002"}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">
                  {(() => {
                    try {
                      const count = parseSerialNumbers(serialNumber).length;
                      return count
                        ? `${count} pieza${count === 1 ? "" : "s"} en esta entrada.`
                        : "Pega o escribe las series de las piezas que entran.";
                    } catch (err) {
                      return err instanceof Error
                        ? err.message
                        : "Revisa las series capturadas.";
                    }
                  })()}
                </span>
              </label>
            ) : (
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
                  Número de serie
                  {selected?.tracksSerial || isEquipmentCatalog
                    ? " (obligatorio)"
                    : ""}
                </span>
                <input
                  value={serialNumber}
                  disabled={!canWrite}
                  required={Boolean(selected?.tracksSerial || isEquipmentCatalog)}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  className={fieldClass}
                />
              </label>
            )}

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
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted",
                      (!canWrite || submitting) && "pointer-events-none opacity-60"
                    )}
                  >
                    <Camera className="size-4" />
                    {evidenceFiles.length ? "Agregar más" : "Agregar fotos"}
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
              type="submit"
              disabled={!canWrite || submitting || items.length === 0}
              className="w-fit border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
            >
              {submitting
                ? "Guardando..."
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
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Actualizar
            </button>
          </div>

          <SearchInput
            value={historyQuery}
            onChange={setHistoryQuery}
            placeholder="Buscar folio, artículo, n.º de parte o motivo..."
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
                          {row.productSku} — {withPartNumber(row.productName, row.partNumber)}
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
