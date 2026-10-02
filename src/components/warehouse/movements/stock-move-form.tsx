"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  getMovementsByFolio,
  getProductStock,
  moveStock,
  serialsForBalance,
  type StockBalance,
  type StockSerial,
} from "@/lib/warehouse/movements";
import type { Warehouse, WarehouseLocation } from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";
import {
  Alert,
  ExpiryTag,
  Field,
  KindBadge,
  ProductPicker,
  StepTitle,
  inputClass,
  primaryButtonClass,
} from "./movement-ui";
import { MovementVoucherActions } from "./movement-pdf-actions";

const NEW_LOCATION = "__new";

type Props = {
  products: InventoryItem[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  canWrite: boolean;
  onDone: () => void;
};

export function StockMoveForm({ products, warehouses, locations, canWrite, onDone }: Props) {
  const [product, setProduct] = useState<InventoryItem | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [serials, setSerials] = useState<StockSerial[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastFolio, setLastFolio] = useState("");

  const source = balances.find((balance) => balance.id === sourceId) ?? null;
  const sourceSerials = useMemo(
    () => (source ? serialsForBalance(serials, source) : []),
    [serials, source]
  );
  const usesSerials = sourceSerials.length > 0;
  const moveQty = usesSerials ? selectedSerials.length : quantity;

  const destinationLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          location.warehouseId === toWarehouseId &&
          !(source && toWarehouseId === source.warehouseId && location.id === source.locationId)
      ),
    [locations, toWarehouseId, source]
  );

  const toWarehouse = warehouses.find((warehouse) => warehouse.id === toWarehouseId) ?? null;
  const toLocationLabel =
    toLocationId === NEW_LOCATION
      ? newLocationName.trim()
      : (destinationLocations.find((location) => location.id === toLocationId)?.name ?? "");
  const isTransfer = Boolean(source && toWarehouseId && source.warehouseId !== toWarehouseId);

  function loadStock(item: InventoryItem, keepSourceId = "") {
    setLoadingStock(true);
    return getProductStock(item.id)
      .then((stock) => {
        setBalances(stock.balances);
        setSerials(stock.serials);
        const next =
          stock.balances.find((balance) => balance.id === keepSourceId) ??
          (stock.balances.length === 1 ? stock.balances[0] : null);
        selectSource(next);
      })
      .catch((err) => {
        setBalances([]);
        setSerials([]);
        setError(err instanceof Error ? err.message : "No se pudieron cargar las existencias.");
      })
      .finally(() => setLoadingStock(false));
  }

  function selectProduct(item: InventoryItem | null) {
    setProduct(item);
    setBalances([]);
    setSerials([]);
    selectSource(null);
    setError("");
    setMessage("");
    setLastFolio("");
    if (item) void loadStock(item);
  }

  function selectSource(balance: StockBalance | null) {
    setSourceId(balance?.id ?? "");
    setQuantity(balance ? Math.min(1, balance.available) : 1);
    setSelectedSerials([]);
    setToWarehouseId((current) => current || balance?.warehouseId || "");
    setToLocationId("");
    setNewLocationName("");
  }

  function toggleSerial(serial: string) {
    setSelectedSerials((current) =>
      current.includes(serial) ? current.filter((item) => item !== serial) : [...current, serial]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !product || !source) return;
    if (moveQty <= 0) {
      setError(usesSerials ? "Selecciona al menos un número de serie." : "La cantidad debe ser mayor a 0.");
      return;
    }
    if (moveQty > source.available) {
      setError(`Solo hay ${source.available} disponible(s) en el origen.`);
      return;
    }
    if (!toWarehouseId || !toLocationLabel) {
      setError("Selecciona el almacén y la ubicación destino.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    setLastFolio("");
    try {
      const result = await moveStock({
        productId: product.id,
        source,
        quantity: moveQty,
        toWarehouseId,
        toLocationId: toLocationId === NEW_LOCATION ? null : toLocationId,
        toLocationName: toLocationId === NEW_LOCATION ? newLocationName : null,
        serialNumbers: usesSerials ? selectedSerials : undefined,
        note,
        createdBy: getSession()?.username ?? "",
      });
      setMessage(
        `${result.folio}: ${result.movedQty} ${product.unit} de ${product.name} movidas de ${source.warehouseCode} — ${source.locationName} a ${toWarehouse?.code ?? ""} — ${result.locationName}.`
      );
      setLastFolio(result.folio);
      setNote("");
      await loadStock(product, source.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el movimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <section className="space-y-3">
        <StepTitle step={1} title="Producto" />
        <ProductPicker
          products={products}
          value={product}
          onChange={selectProduct}
          disabled={submitting}
        />
      </section>

      {product ? (
        <section className="space-y-3">
          <StepTitle step={2} title="Origen">
            {loadingStock ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </StepTitle>
          {!loadingStock && balances.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Este producto no tiene existencia en ningún almacén. Registra una entrada primero.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2 font-medium">Almacén</th>
                    <th className="px-3 py-2 font-medium">Ubicación</th>
                    <th className="px-3 py-2 font-medium">Lote</th>
                    <th className="px-3 py-2 font-medium">Caducidad</th>
                    <th className="px-3 py-2 text-right font-medium">Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((balance) => {
                    const active = balance.id === sourceId;
                    return (
                      <tr
                        key={balance.id}
                        onClick={() => selectSource(balance)}
                        className={cn(
                          "cursor-pointer border-t border-border/70 transition-colors",
                          active ? "bg-[#00BFFF]/10" : "hover:bg-muted/40"
                        )}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="radio"
                            name="move-source"
                            checked={active}
                            onChange={() => selectSource(balance)}
                            aria-label={`${balance.warehouseCode} ${balance.locationName} ${balance.lotNumber}`}
                            className="accent-[#00BFFF]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{balance.warehouseCode}</span>
                          <span className="block text-xs text-muted-foreground">{balance.warehouseName}</span>
                        </td>
                        <td className="px-3 py-2">{balance.locationName || "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{balance.lotNumber || "—"}</td>
                        <td className="px-3 py-2">
                          <ExpiryTag date={balance.expiryDate} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-medium">{balance.available}</span>
                          {balance.reserved > 0 ? (
                            <span className="block text-xs text-muted-foreground">
                              {balance.reserved} apartado(s)
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {source ? (
            usesSerials ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Números de serie a mover{" "}
                  <span className="text-muted-foreground">({selectedSerials.length} seleccionados)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {sourceSerials.map((serial) => {
                    const checked = selectedSerials.includes(serial.serialNumber);
                    return (
                      <label
                        key={serial.serialNumber}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-xs",
                          checked ? "border-[#00BFFF] bg-[#00BFFF]/10" : "border-border hover:bg-muted/40"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSerial(serial.serialNumber)}
                          className="accent-[#00BFFF]"
                        />
                        {serial.serialNumber}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Field label={`Cantidad a mover (${product.unit})`} hint={`Disponible en el origen: ${source.available}`}>
                <div className="flex max-w-xs gap-2">
                  <input
                    type="number"
                    min={1}
                    max={source.available}
                    value={quantity || ""}
                    onChange={(event) => setQuantity(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                    className={inputClass}
                  />
                  <Button type="button" variant="outline" onClick={() => setQuantity(source.available)}>
                    Todo
                  </Button>
                </div>
              </Field>
            )
          ) : null}
        </section>
      ) : null}

      {source ? (
        <section className="space-y-3">
          <StepTitle step={3} title="Destino" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Almacén destino">
              <select
                value={toWarehouseId}
                onChange={(event) => {
                  setToWarehouseId(event.target.value);
                  setToLocationId("");
                }}
                className={inputClass}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                    {warehouse.id === source.warehouseId ? " (mismo almacén)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ubicación destino">
              <select
                value={toLocationId}
                onChange={(event) => setToLocationId(event.target.value)}
                className={inputClass}
              >
                <option value="">Selecciona la ubicación</option>
                {destinationLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
                <option value={NEW_LOCATION}>+ Nueva ubicación…</option>
              </select>
            </Field>
            {toLocationId === NEW_LOCATION ? (
              <Field label="Nombre de la nueva ubicación" className="sm:col-span-2">
                <input
                  value={newLocationName}
                  onChange={(event) => setNewLocationName(event.target.value)}
                  placeholder="Ej. Rack A - Nivel 2"
                  className={inputClass}
                />
              </Field>
            ) : null}
          </div>

          <Field label="Nota">
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={isTransfer ? "Motivo del traspaso, guía de envío, quién recibe..." : "Motivo del cambio de ubicación..."}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#00BFFF] focus:ring-2 focus:ring-[#00BFFF]/25"
            />
          </Field>

          {toLocationLabel && moveQty > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm">
              <KindBadge kind={isTransfer ? "traspaso" : "cambio_ubicacion"} />
              <span className="font-medium">
                {moveQty} {product?.unit}
              </span>
              <span className="text-muted-foreground">
                {source.warehouseCode} — {source.locationName}
              </span>
              <ArrowRight className="size-4 text-muted-foreground" />
              <span className="font-medium">
                {toWarehouse?.code} — {toLocationLabel}
              </span>
              {source.lotNumber ? (
                <span className="text-xs text-muted-foreground">· lote {source.lotNumber}</span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? (
        <div className="space-y-2">
          <Alert tone="success">{message}</Alert>
          {lastFolio ? (
            <MovementVoucherActions
              records={() => getMovementsByFolio([lastFolio])}
              warehouses={warehouses}
              variant="button"
              onError={setError}
            />
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={!canWrite || submitting || !source || moveQty <= 0 || !toLocationLabel}
        className={primaryButtonClass}
      >
        {submitting ? "Guardando..." : isTransfer ? "Registrar traspaso" : "Registrar cambio de ubicación"}
      </Button>
    </form>
  );
}
