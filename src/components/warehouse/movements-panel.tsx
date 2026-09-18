"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { getSession } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import {
  exchangeExpiredProduct,
  getWarehouseMovements,
  transferProductLocation,
  type WarehouseMovement,
} from "@/lib/warehouse/movements";
import { getProductLots, type ProductLot } from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions } from "@/lib/auth/use-permissions";

const TYPE_LABELS: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  cambio_ubicacion: "Cambio de ubicación",
  canje_caducado: "Canje caducado",
};

function isExpiredOrNear(item: InventoryItem) {
  if (!item.expiryDate) return false;
  const expiry = new Date(item.expiryDate);
  const limit = new Date();
  limit.setDate(limit.getDate() + 30);
  return expiry <= limit;
}

function isLotExpiredOrNear(lot: ProductLot) {
  if (!lot.expiryDate) return false;
  const expiry = new Date(lot.expiryDate);
  const limit = new Date();
  limit.setDate(limit.getDate() + 30);
  return expiry <= limit;
}

export function MovementsPanel() {
  const { canWrite } = usePermissions("movimientos");
  const [movements, setMovements] = useState<WarehouseMovement[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"ubicacion" | "canje">("ubicacion");

  const [itemId, setItemId] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [supplierName, setSupplierName] = useState("");
  const [outgoingLot, setOutgoingLot] = useState("");
  const [newLot, setNewLot] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    const [movementList, productList, supplierList] = await Promise.all([
      getWarehouseMovements(),
      getInventoryItems({ kind: "producto" }),
      getSuppliers(),
    ]);
    setMovements(movementList);
    setProducts(productList);
    setSuppliers(supplierList.filter((item) => item.isActive));
    if (!itemId && productList[0]) setItemId(productList[0].id);
    if (!supplierName && supplierList[0]) setSupplierName(supplierList[0].name);
  }

  useEffect(() => {
    void refresh()
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los movimientos."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => products.find((item) => item.id === itemId) ?? null,
    [products, itemId]
  );

  const insumosProducts = useMemo(
    () => products.filter((item) => item.category === "insumos"),
    [products]
  );

  const selectableProducts = mode === "canje" ? insumosProducts : products;

  const expiredCandidates = useMemo(
    () => insumosProducts.filter((item) => isExpiredOrNear(item)),
    [insumosProducts]
  );

  useEffect(() => {
    if (!selectableProducts.some((item) => item.id === itemId)) {
      setItemId(selectableProducts[0]?.id ?? "");
    }
  }, [mode, selectableProducts, itemId]);

  useEffect(() => {
    if (mode !== "canje" || !itemId) {
      setLots([]);
      setOutgoingLot("");
      return;
    }
    let cancelled = false;
    void getProductLots(itemId)
      .then((rows) => {
        if (cancelled) return;
        setLots(rows);
        const preferred =
          rows.find((lot) => isLotExpiredOrNear(lot)) ?? rows[0];
        setOutgoingLot(preferred?.lotNumber ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        setLots([]);
        setOutgoingLot("");
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los lotes del insumo."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [mode, itemId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !canWrite) return;
    if (mode === "canje" && selected.category !== "insumos") {
      setError(
        "El canje de caducados solo aplica para productos del inventario de insumos."
      );
      return;
    }
    if (mode === "canje" && !outgoingLot.trim()) {
      setError("Selecciona el lote caducado o por canjear.");
      return;
    }
    if (mode === "canje" && !newLot.trim()) {
      setError("Indica el lote nuevo del proveedor.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const session = getSession();
      if (mode === "ubicacion") {
        await transferProductLocation({
          itemId: selected.id,
          newLocation,
          note,
          createdBy: session?.username ?? "",
        });
        setMessage(
          `Ubicación actualizada: ${selected.name} ahora está en "${newLocation}".`
        );
        setNewLocation("");
      } else {
        await exchangeExpiredProduct({
          itemId: selected.id,
          quantity,
          supplierName,
          outgoingLotNumber: outgoingLot,
          newLotNumber: newLot,
          newExpiryDate: newExpiry,
          note,
          createdBy: session?.username ?? "",
        });
        setMessage(
          `Canje registrado: ${quantity} ${selected.unit} de ${selected.name} · lote ${outgoingLot} → ${newLot}.`
        );
        setQuantity(1);
        setNewLot("");
        setNewExpiry("");
      }
      setNote("");
      await refresh();
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
      <p className="text-sm text-muted-foreground">Cargando movimientos...</p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Movimientos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cambia materiales de ubicación o registra canjes con proveedores por
          insumos caducados o próximos a caducar.
        </p>

        <div className="mt-4">
          <ReadOnlyBanner visible={!canWrite} />
        </div>

        <div className="mt-4 flex w-full flex-col gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:inline-flex sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => setMode("ubicacion")}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm sm:py-1.5",
              mode === "ubicacion"
                ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                : "text-muted-foreground"
            )}
          >
            Cambio de ubicación
          </button>
          <button
            type="button"
            onClick={() => setMode("canje")}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm sm:py-1.5",
              mode === "canje"
                ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                : "text-muted-foreground"
            )}
          >
            Canje caducado
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid max-w-2xl gap-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">
              {mode === "canje" ? "Insumo" : "Producto"}
            </span>
            <select
              required
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              {selectableProducts.length === 0 ? (
                <option value="">
                  {mode === "canje"
                    ? "No hay insumos disponibles"
                    : "No hay productos disponibles"}
                </option>
              ) : null}
              {selectableProducts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name}
                  {item.expiryDate ? ` · cad. ${item.expiryDate}` : ""}
                  {isExpiredOrNear(item) ? " · CADUCADO/PRÓXIMO" : ""}
                  {item.location ? ` · ${item.location}` : ""}
                </option>
              ))}
            </select>
            {mode === "canje" ? (
              <p className="text-xs text-muted-foreground">
                Solo productos de la categoría Insumos.
                {expiredCandidates.length > 0
                  ? ` Hay ${expiredCandidates.length} caducado(s) o por caducar en 30 días.`
                  : ""}
              </p>
            ) : null}
          </label>

          {selected ? (
            <div className="grid gap-1 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-1">
              <p>
                Ubicación:{" "}
                <span className="font-medium text-foreground">
                  {selected.location || "Sin ubicación"}
                </span>
              </p>
              <p>
                Caducidad:{" "}
                <span className="font-medium text-foreground">
                  {selected.expiryDate || "Sin fecha"}
                </span>
              </p>
              <p>
                Stock:{" "}
                <span className="font-medium text-foreground">
                  {selected.quantity} {selected.unit}
                </span>
              </p>
            </div>
          ) : null}

          {mode === "ubicacion" ? (
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Nueva ubicación</span>
              <input
                required
                value={newLocation}
                onChange={(event) => setNewLocation(event.target.value)}
                placeholder="Ej. Almacén B - Estante 3"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
              />
            </label>
          ) : (
            <>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Cantidad a canjear</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={selected?.quantity ?? undefined}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
                  Lote a canjear (caducado) *
                </span>
                {lots.length > 0 ? (
                  <select
                    required
                    value={outgoingLot}
                    onChange={(event) => setOutgoingLot(event.target.value)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                  >
                    <option value="">Selecciona el lote</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.lotNumber}>
                        {lot.lotNumber}
                        {lot.expiryDate ? ` · cad. ${lot.expiryDate}` : ""}
                        {isLotExpiredOrNear(lot) ? " · CADUCADO/PRÓXIMO" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={outgoingLot}
                    onChange={(event) => setOutgoingLot(event.target.value)}
                    placeholder="Número de lote caducado"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                  />
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
                  Lote nuevo del proveedor *
                </span>
                <input
                  required
                  value={newLot}
                  onChange={(event) => setNewLot(event.target.value)}
                  placeholder="Número de lote que entrega el proveedor"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Proveedor del canje</span>
                <select
                  required
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                >
                  {suppliers.length === 0 ? (
                    <option value="">Registra un proveedor primero</option>
                  ) : (
                    suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.name}>
                        {supplier.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">
                  Nueva fecha de caducidad
                </span>
                <input
                  required
                  type="date"
                  value={newExpiry}
                  onChange={(event) => setNewExpiry(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
                />
              </label>
            </>
          )}

          <label className="space-y-1.5">
            <span className="text-sm font-medium">Nota</span>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                mode === "ubicacion"
                  ? "Motivo del traslado interno..."
                  : "Folio de canje, autorización del proveedor..."
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
            />
          </label>

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
            disabled={!canWrite || submitting || products.length === 0}
            className="w-full border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90 sm:w-fit"
          >
            {submitting
              ? "Guardando..."
              : mode === "ubicacion"
                ? "Registrar cambio de ubicación"
                : "Registrar canje caducado"}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Historial</h3>
          <p className="text-sm text-muted-foreground">
            Incluye cambios de ubicación, canjes y también entradas/salidas.
          </p>
        </div>
        <ResponsiveDataList
          emptyMessage="Aún no hay movimientos registrados."
          items={movements.map((movement) => ({
            key: movement.id,
            title: movement.itemName,
            subtitle: movement.itemSku,
            badge: (
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                  movement.movementType === "cambio_ubicacion"
                    ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                    : movement.movementType === "canje_caducado"
                      ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      : movement.movementType === "entrada"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                )}
              >
                {TYPE_LABELS[movement.movementType] ?? movement.movementType}
              </span>
            ),
            fields: [
              {
                label: "Fecha",
                value: new Date(movement.createdAt).toLocaleString("es-MX"),
              },
              {
                label: "Detalle",
                value:
                  movement.movementType === "cambio_ubicacion"
                    ? `${movement.fromLocation} → ${movement.toLocation}`
                    : movement.movementType === "canje_caducado"
                      ? `${movement.quantity} u. · ${movement.supplierName}`
                      : `${movement.previousQuantity} → ${movement.newQuantity}`,
              },
              { label: "Nota", value: movement.note || "—" },
            ],
          }))}
        />

        <DesktopTable>
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
                <th className="px-4 py-3 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Aún no hay movimientos registrados.
                  </td>
                </tr>
              ) : (
                movements.map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-t border-border/70 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(movement.createdAt).toLocaleString("es-MX")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          movement.movementType === "cambio_ubicacion"
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            : movement.movementType === "canje_caducado"
                              ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                              : movement.movementType === "entrada"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {TYPE_LABELS[movement.movementType] ??
                          movement.movementType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{movement.itemName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {movement.itemSku}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {movement.movementType === "cambio_ubicacion"
                        ? `${movement.fromLocation} → ${movement.toLocation}`
                        : movement.movementType === "canje_caducado"
                          ? `${movement.quantity} u. · ${movement.supplierName} · cad. ${movement.previousExpiry || "—"} → ${movement.newExpiry || "—"}`
                          : `${movement.previousQuantity} → ${movement.newQuantity} (${movement.quantity})`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {movement.note || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </DesktopTable>
      </section>
    </div>
  );
}
