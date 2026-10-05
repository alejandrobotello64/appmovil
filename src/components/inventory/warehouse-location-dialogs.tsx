"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isUnplacedLocation,
  placementsFor,
  type InventoryStock,
} from "@/lib/inventory/tracking";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  createWarehouse,
  createWarehouseLocation,
  deactivateWarehouseLocation,
  getWarehouseLocations,
  getWarehouses,
  relocateStock,
  setWarehouseActive,
  type RelocateResult,
  type Warehouse,
  type WarehouseLocation,
} from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";

const NEW_LOCATION = "__new__";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20";

function Dialog({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function sortLocations(locations: WarehouseLocation[]) {
  return [...locations].sort(
    (a, b) =>
      Number(isUnplacedLocation(a.code)) - Number(isUnplacedLocation(b.code)) ||
      a.name.localeCompare(b.name, "es")
  );
}

type RelocateStockModalProps = {
  item: InventoryItem;
  stock: InventoryStock | undefined;
  warehouses: Warehouse[];
  initialWarehouseId: string;
  actor: string;
  onClose: () => void;
  onDone: (result: RelocateResult, warehouse: Warehouse) => void;
};

export function RelocateStockModal({
  item,
  stock,
  warehouses,
  initialWarehouseId,
  actor,
  onClose,
  onDone,
}: RelocateStockModalProps) {
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loadedFor, setLoadedFor] = useState("");
  const [locationId, setLocationId] = useState("");
  const [newName, setNewName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const warehouse = warehouses.find((w) => w.id === warehouseId);
  const placements = placementsFor(stock, warehouseId);
  const quantity = placements.reduce((sum, p) => sum + p.quantity, 0);
  const serialCount = (stock?.serials ?? []).filter((s) => s.warehouseId === warehouseId).length;
  const loadingLocations = Boolean(warehouseId) && loadedFor !== warehouseId;

  useEffect(() => {
    if (!warehouseId) return;
    let cancelled = false;
    void getWarehouseLocations(warehouseId)
      .then((rows) => {
        if (cancelled) return;
        const sorted = sortLocations(rows);
        setLocations(sorted);
        setLoadedFor(warehouseId);
        const legacy = item.location.trim().toLowerCase();
        const match = legacy
          ? sorted.find((loc) => loc.name.trim().toLowerCase() === legacy)
          : undefined;
        if (match) {
          setLocationId(match.id);
        } else if (legacy) {
          setLocationId(NEW_LOCATION);
          setNewName(item.location.trim());
        } else {
          setLocationId(sorted.find((loc) => !isUnplacedLocation(loc.code))?.id ?? NEW_LOCATION);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, item.location]);

  const physical = locations.filter((loc) => !isUnplacedLocation(loc.code));
  const generic = locations.filter((loc) => isUnplacedLocation(loc.code));
  const creating = locationId === NEW_LOCATION;

  async function handleSubmit() {
    if (!warehouse) {
      setError("Selecciona un almacén.");
      return;
    }
    if (creating ? !newName.trim() : !locationId) {
      setError("Selecciona o escribe la ubicación destino.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const result = await relocateStock({
        productId: item.id,
        warehouseId: warehouse.id,
        locationId: creating ? null : locationId,
        locationName: creating ? newName : null,
        note,
        createdBy: actor,
      });
      onDone(result, warehouse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ubicar el artículo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      title={`Ubicar ${item.name}`}
      subtitle={`${item.sku} · elige el almacén y el lugar físico donde está guardado.`}
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Almacén</span>
          <select
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value);
              setLocationId("");
              setNewName("");
            }}
            className={inputClass}
          >
            <option value="">Selecciona…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.city ? ` · ${w.city}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Ubicación dentro del almacén</span>
          <select
            value={locationId}
            disabled={!warehouseId || loadingLocations}
            onChange={(event) => setLocationId(event.target.value)}
            className={inputClass}
          >
            {loadingLocations ? <option value="">Cargando…</option> : null}
            {physical.length > 0 ? (
              <optgroup label="Ubicaciones físicas">
                {physical.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {generic.length > 0 ? (
              <optgroup label="Genéricas por categoría">
                {generic.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value={NEW_LOCATION}>+ Nueva ubicación…</option>
          </select>
        </label>

        {creating ? (
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Nombre de la nueva ubicación</span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ej. Rack A / Nivel 2, Sala de cámaras, Anaquel 3"
              className={inputClass}
            />
          </label>
        ) : null}

        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium">Nota (opcional)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Motivo de la reubicación"
            className={inputClass}
          />
        </label>
      </div>

      {warehouse ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3 text-sm">
          <p className="mb-1 font-medium">Existencia actual en {warehouse.name}</p>
          {placements.length === 0 && serialCount === 0 ? (
            <p className="text-muted-foreground">
              No hay existencia en este almacén. Solo se registrará la ubicación asignada del
              artículo.
            </p>
          ) : (
            <>
              <ul className="space-y-0.5 text-muted-foreground">
                {placements.map((p) => (
                  <li key={p.locationName}>
                    {p.locationName}
                    {p.unplaced ? " (genérica)" : ""} · {p.quantity} {item.unit}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Se moverán {quantity} {item.unit}
                {serialCount > 0 ? ` y ${serialCount} número(s) de serie` : ""} a la ubicación
                elegida, conservando lotes y caducidades. Queda registrado como cambio de
                ubicación.
              </p>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !warehouseId || loadingLocations}
          className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
          Ubicar aquí
        </Button>
      </div>
    </Dialog>
  );
}

type WarehouseManagerModalProps = {
  canEditLocations: boolean;
  canManageWarehouses: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function WarehouseManagerModal({
  canEditLocations,
  canManageWarehouses,
  onClose,
  onChanged,
}: WarehouseManagerModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [newLocation, setNewLocation] = useState("");
  const [draft, setDraft] = useState({ code: "", name: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getWarehouses(true)
      .then((rows) => {
        if (cancelled) return;
        setWarehouses(rows);
        setSelectedId(
          (current) =>
            current ||
            rows.find((w) => w.isDefault && w.isActive)?.id ||
            rows.find((w) => w.isActive)?.id ||
            ""
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void getWarehouseLocations(selectedId)
      .then((rows) => {
        if (!cancelled) setLocations(sortLocations(rows));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, reloadKey]);

  const selected = useMemo(
    () => warehouses.find((w) => w.id === selectedId),
    [warehouses, selectedId]
  );

  async function run(action: () => Promise<unknown>) {
    try {
      setBusy(true);
      setError("");
      await action();
      setReloadKey((key) => key + 1);
      onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLocation() {
    if (!selectedId || !newLocation.trim()) return;
    if (await run(() => createWarehouseLocation(selectedId, newLocation))) setNewLocation("");
  }

  async function handleRemoveLocation(location: WarehouseLocation) {
    if (!window.confirm(`¿Dar de baja la ubicación "${location.name}"?`)) return;
    await run(() => deactivateWarehouseLocation(location.id));
  }

  async function handleAddWarehouse() {
    const created = await run(async () => {
      const warehouse = await createWarehouse(draft);
      setSelectedId(warehouse.id);
    });
    if (created) setDraft({ code: "", name: "", city: "" });
  }

  async function handleToggleWarehouse(warehouse: Warehouse) {
    const verb = warehouse.isActive ? "Desactivar" : "Activar";
    if (!window.confirm(`¿${verb} ${warehouse.name}?`)) return;
    await run(() => setWarehouseActive(warehouse.id, !warehouse.isActive));
  }

  return (
    <Dialog
      title="Almacenes y ubicaciones"
      subtitle="Almacenes con los que trabaja la empresa y los lugares físicos dentro de cada uno."
      onClose={onClose}
    >
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {warehouses.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedId(w.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm",
                w.id === selectedId
                  ? "border-[#3B46A5] bg-[#00BFFF]/10"
                  : "border-border hover:bg-muted/50",
                !w.isActive && "opacity-60"
              )}
            >
              <WarehouseIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="block font-medium">{w.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {w.code}
                  {w.city ? ` · ${w.city}` : ""}
                  {w.isDefault ? " · Predeterminado" : ""}
                  {!w.isActive ? " · Inactivo" : ""}
                </span>
              </span>
            </button>
          ))}

          {canManageWarehouses ? (
            <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Nuevo almacén</p>
              <input
                value={draft.code}
                onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                placeholder="Clave (ej. MTY)"
                className={inputClass}
              />
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Nombre"
                className={inputClass}
              />
              <input
                value={draft.city}
                onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                placeholder="Ciudad"
                className={inputClass}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy || !draft.code.trim() || !draft.name.trim()}
                onClick={() => void handleAddWarehouse()}
              >
                <Plus className="size-4" /> Agregar almacén
              </Button>
            </div>
          ) : null}
        </div>

        <div>
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Ubicaciones en {selected.name}</p>
                {canManageWarehouses && !selected.isDefault ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleToggleWarehouse(selected)}
                  >
                    {selected.isActive ? "Desactivar almacén" : "Activar almacén"}
                  </Button>
                ) : null}
              </div>

              <ul className="divide-y divide-border rounded-xl border border-border">
                {locations.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground">Sin ubicaciones.</li>
                ) : (
                  locations.map((loc) => {
                    const generic = isUnplacedLocation(loc.code);
                    return (
                      <li key={loc.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="text-sm">
                          {loc.name}
                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                            {loc.code}
                          </span>
                          {generic ? (
                            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              Genérica
                            </span>
                          ) : null}
                        </span>
                        {canEditLocations && !generic ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRemoveLocation(loc)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Dar de baja ${loc.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>

              {canEditLocations && selected.isActive ? (
                <div className="mt-3 flex gap-2">
                  <input
                    value={newLocation}
                    onChange={(event) => setNewLocation(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleAddLocation();
                    }}
                    placeholder="Nueva ubicación (ej. Rack A / Nivel 2)"
                    className={inputClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !newLocation.trim()}
                    onClick={() => void handleAddLocation()}
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                Las ubicaciones genéricas se crean con cada almacén y reciben las entradas que no
                indican lugar. Usa &quot;Ubicar&quot; en el inventario para mover cada artículo a
                su lugar físico.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona un almacén.</p>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
