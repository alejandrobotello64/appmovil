"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
} from "@/lib/inventory/types";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  ENTRY_REASONS,
  ISSUE_REASONS,
  isServiceIssue,
} from "@/lib/warehouse/reasons";
import {
  getProductLots,
  getWarehouseLocations,
  getWarehouses,
  type ProductLot,
  type Warehouse,
  type WarehouseLocation,
} from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";

type StockMovementPanelProps = {
  mode: "entrada" | "salida";
};

type CatalogKind = SupplyCategoryId | "equipos";

export function StockMovementPanel({ mode }: StockMovementPanelProps) {
  const { canWrite } = usePermissions(mode === "entrada" ? "entradas" : "salidas");
  const [catalogKind, setCatalogKind] = useState<CatalogKind>("insumos");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [lots, setLots] = useState<ProductLot[]>([]);
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
    void Promise.all([loadCatalog(catalogKind), getWarehouses()])
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
  }, [catalogKind]);

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
      })
      .catch(() => setLots([]));
  }, [itemId, mode, isEquipmentCatalog]);

  useEffect(() => {
    if (isEquipmentCatalog) {
      setQuantity(1);
      setLotNumber("");
      setExpiryDate("");
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
        expiryDate: isEquipmentCatalog ? null : expiryDate || null,
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
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {mode === "entrada" ? "Registrar entrada" : "Registrar salida"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "entrada"
                ? "Elige la tabla (insumos, medicamentos, refacciones, etc.) o da de alta un equipo."
                : "Descuenta unidades por tabla. Insumos/medicamentos/reactivos usan caducidad."}
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

        <div className="mt-4 flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {catalogOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setCatalogKind(option.id);
                setError("");
                setMessage("");
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                catalogKind === option.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid max-w-2xl gap-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">
              {isEquipmentCatalog ? "Equipo" : "Artículo"}
            </span>
            <select
              required
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              disabled={!canWrite}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
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
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
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
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
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
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
              />
            </label>
          ) : (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Los equipos se mueven de 1 en 1 como activos (serie obligatoria).
            </p>
          )}

          <label className="space-y-1.5">
            <span className="text-sm font-medium">Motivo</span>
            <select
              value={reason}
              disabled={!canWrite}
              onChange={(event) => setReason(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              {reasons.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

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
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                >
                  <option value="">Sin lote / automático</option>
                  {lots.map((lot) => (
                    <option key={lot.id} value={lot.lotNumber}>
                      {lot.lotNumber}
                      {lot.expiryDate ? ` · cad. ${lot.expiryDate}` : ""}
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
                      (selected?.tracksLot || requiresExpiry) && mode === "entrada"
                    )}
                    onChange={(event) => setLotNumber(event.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">
                    Caducidad
                    {selected?.tracksExpiry || requiresExpiry
                      ? " (obligatoria)"
                      : ""}
                  </span>
                  <input
                    type="date"
                    value={expiryDate}
                    disabled={!canWrite}
                    required={Boolean(
                      (selected?.tracksExpiry || requiresExpiry) &&
                        mode === "entrada"
                    )}
                    onChange={(event) => setExpiryDate(event.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
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
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
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
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
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
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
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
