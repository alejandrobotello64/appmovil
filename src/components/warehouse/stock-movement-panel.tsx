"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
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
import {
  SUPPLY_CATEGORIES,
  categoryRequiresExpiry,
  categoryRequiresManufactureDate,
} from "@/lib/inventory/types";
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

type StockMovementPanelProps = {
  mode: "entrada" | "salida";
};

type CatalogKind = SupplyCategoryId | "equipos";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

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

  const isEquipmentCatalog = catalogKind === "equipos";
  const requiresExpiry =
    !isEquipmentCatalog && categoryRequiresExpiry(catalogKind);
  const requiresManufactureDate =
    !isEquipmentCatalog && categoryRequiresManufactureDate(catalogKind);

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

  useEffect(() => {
    if (!itemId || mode !== "salida" || isEquipmentCatalog) {
      setLots([]);
      return;
    }
    void getProductLots(itemId)
      .then((rows) => {
        setLots(rows);
        setLotNumber(rows[0]?.lotNumber ?? "");
        setExpiryDate(rows[0]?.expiryDate ?? "");
        setManufacturedAt(rows[0]?.manufacturedAt ?? "");
      })
      .catch(() => setLots([]));
  }, [itemId, mode, isEquipmentCatalog]);

  useEffect(() => {
    if (isEquipmentCatalog) {
      setQuantity(1);
      setLotNumber("");
      setExpiryDate("");
      setManufacturedAt("");
    }
  }, [isEquipmentCatalog]);

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
          quantity: Math.max(1, data.quantity || 1),
        },
        session.username
      );
      setCatalogKind("equipos");
      const next = await loadCatalog("equipos");
      if (!next.some((item) => item.id === created.id)) {
        setItems([created, ...next]);
      }
      setItemId(created.id);
      setSerialNumber(created.serialNumber || "");
      setEquipmentFormOpen(false);
      setMessage(
        `Equipo ${created.sku} dado de alta${
          created.quantity > 0 ? ` con existencia ${created.quantity}` : ""
        }.`
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
      if (mode === "entrada" && (selected.tracksLot || requiresExpiry) && !lotNumber.trim()) {
        throw new Error(
          requiresExpiry
            ? "Insumos, medicamentos y reactivos exigen número de lote."
            : "Este producto exige número de lote."
        );
      }
      if (mode === "entrada" && (selected.tracksExpiry || requiresExpiry) && !expiryDate) {
        throw new Error(
          requiresExpiry
            ? "Insumos, medicamentos y reactivos exigen fecha de caducidad."
            : "Este producto exige fecha de caducidad."
        );
      }
      if (mode === "entrada" && requiresManufactureDate && !manufacturedAt) {
        throw new Error("Los accesorios exigen fecha de fabricación.");
      }
      if (selected.tracksSerial && !serialNumber.trim()) {
        throw new Error(
          isEquipmentCatalog
            ? "El equipo exige número de serie."
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
      const result = await applyStockMovement({
        productId: selected.id,
        movementType: mode,
        quantity: isEquipmentCatalog ? 1 : quantity,
        createdBy: session.username,
        note: extraNote,
        reason: reasonLabel,
        warehouseId: warehouseId || null,
        locationId: locationId || null,
        lotNumber: isEquipmentCatalog ? null : lotNumber || null,
        expiryDate:
          isEquipmentCatalog || requiresManufactureDate
            ? null
            : expiryDate || null,
        manufacturedAt: requiresManufactureDate ? manufacturedAt || null : null,
        serialNumber: serialNumber || null,
      });
      const updated = {
        ...selected,
        quantity: result.newQuantity,
      };

      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage(
        mode === "entrada"
          ? `Entrada ${result.folio}. Nuevo stock: ${updated.quantity} ${updated.unit}.`
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
      await loadHistory();
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
                  ? "Elige categoría y tipo de registro, o da de alta un equipo."
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

            <label className="space-y-1.5">
              <span className="text-sm font-medium">
                {isEquipmentCatalog ? "Equipo" : "Artículo"}
              </span>
              <select
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
                  items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.name}
                      {isEquipmentCatalog && item.serialNumber
                        ? ` · S/N ${item.serialNumber}`
                        : ` (${item.quantity} ${item.unit})`}
                    </option>
                  ))
                )}
              </select>
            </label>

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
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Los equipos se mueven de 1 en 1 como activos (serie obligatoria).
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
                        {lot.lotNumber}
                        {requiresManufactureDate
                          ? lot.manufacturedAt
                            ? ` · fab. ${lot.manufacturedAt}`
                            : ""
                          : lot.expiryDate
                            ? ` · cad. ${lot.expiryDate}`
                            : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">
                      Lote
                      {selected?.tracksLot || requiresExpiry
                        ? " (obligatorio)"
                        : ""}
                    </span>
                    <input
                      value={lotNumber}
                      disabled={!canWrite}
                      required={Boolean(
                        (selected?.tracksLot || requiresExpiry) &&
                          mode === "entrada"
                      )}
                      onChange={(event) => setLotNumber(event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">
                      {requiresManufactureDate
                        ? "Fecha de fabricación"
                        : "Caducidad"}
                      {requiresManufactureDate ||
                      selected?.tracksExpiry ||
                      requiresExpiry
                        ? " (obligatoria)"
                        : ""}
                    </span>
                    <input
                      type="date"
                      value={
                        requiresManufactureDate ? manufacturedAt : expiryDate
                      }
                      disabled={!canWrite}
                      required={Boolean(
                        mode === "entrada" &&
                          (requiresManufactureDate ||
                            selected?.tracksExpiry ||
                            requiresExpiry)
                      )}
                      onChange={(event) =>
                        requiresManufactureDate
                          ? setManufacturedAt(event.target.value)
                          : setExpiryDate(event.target.value)
                      }
                      className={fieldClass}
                    />
                  </label>
                </div>
              )
            ) : null}

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

          <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {historyLoading ? (
              <p className="text-sm text-muted-foreground">Cargando historial...</p>
            ) : history.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Aún no hay {mode === "entrada" ? "entradas" : "salidas"}{" "}
                registradas.
              </p>
            ) : (
              history.map((row) => {
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
                          {row.productSku} — {row.productName}
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
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {equipmentFormOpen && canWrite ? (
        <ModalShell
          title="Dar de alta equipo"
          description="Registra un equipo médico nuevo desde entradas o salidas. Quedará disponible de inmediato para el movimiento."
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
