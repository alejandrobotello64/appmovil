"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { daysUntilExpiry } from "@/lib/inventory/expiry";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  exchangeExpiredProduct,
  getMovementsByFolio,
  getProductStock,
  type StockBalance,
} from "@/lib/warehouse/movements";
import type { Warehouse } from "@/lib/warehouse/stock";
import type { Supplier } from "@/lib/suppliers/types";
import { cn } from "@/lib/utils";
import {
  Alert,
  ExpiryTag,
  Field,
  ProductPicker,
  StepTitle,
  inputClass,
  primaryButtonClass,
} from "./movement-ui";
import { MovementVoucherActions } from "./movement-pdf-actions";

const NEAR_EXPIRY_DAYS = 30;

function isExpiredOrNear(date: string) {
  const days = daysUntilExpiry(date);
  return days !== null && days <= NEAR_EXPIRY_DAYS;
}

type Props = {
  products: InventoryItem[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  canWrite: boolean;
  onDone: () => void;
};

export function ExpiredExchangeForm({ products, suppliers, warehouses, canWrite, onDone }: Props) {
  const insumos = useMemo(
    () => products.filter((item) => item.category === "insumos"),
    [products]
  );
  const candidates = useMemo(
    () => insumos.filter((item) => item.quantity > 0 && isExpiredOrNear(item.expiryDate)),
    [insumos]
  );

  const [product, setProduct] = useState<InventoryItem | null>(null);
  const [lots, setLots] = useState<StockBalance[]>([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [supplierName, setSupplierName] = useState("");
  const [newLot, setNewLot] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastFolios, setLastFolios] = useState<string[]>([]);

  const source = lots.find((lot) => lot.id === sourceId) ?? null;

  function loadLots(item: InventoryItem) {
    setLoadingLots(true);
    return getProductStock(item.id)
      .then((stock) => {
        const withLot = stock.balances
          .filter((balance) => balance.lotNumber)
          .sort((a, b) => (a.expiryDate || "9999").localeCompare(b.expiryDate || "9999"));
        setLots(withLot);
        const preferred = withLot.find((lot) => isExpiredOrNear(lot.expiryDate)) ?? withLot[0];
        setSourceId(preferred?.id ?? "");
        setQuantity(preferred ? Math.min(1, preferred.available) : 1);
      })
      .catch((err) => {
        setLots([]);
        setError(err instanceof Error ? err.message : "No se pudieron cargar los lotes.");
      })
      .finally(() => setLoadingLots(false));
  }

  function selectProduct(item: InventoryItem | null) {
    setProduct(item);
    setLots([]);
    setSourceId("");
    setError("");
    setMessage("");
    setLastFolios([]);
    if (item) {
      setSupplierName((current) => item.supplier || current || suppliers[0]?.name || "");
      void loadLots(item);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !product || !source) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    setLastFolios([]);
    try {
      const folios = await exchangeExpiredProduct({
        productId: product.id,
        source,
        quantity,
        supplierName,
        newLotNumber: newLot,
        newExpiryDate: newExpiry,
        note,
        createdBy: getSession()?.username ?? "",
      });
      setMessage(
        `Canje registrado (${folios.join(", ")}): ${quantity} ${product.unit} de ${product.name} · lote ${source.lotNumber} → ${newLot.trim()}.`
      );
      setLastFolios(folios);
      setNewLot("");
      setNewExpiry("");
      setNote("");
      await loadLots(product);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el canje.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <section className="space-y-3">
        <StepTitle step={1} title="Insumo" />
        <ProductPicker
          products={insumos}
          value={product}
          onChange={selectProduct}
          disabled={submitting}
          placeholder="Buscar insumo por SKU o nombre..."
        />
        {!product && candidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {candidates.length} insumo(s) caducado(s) o por caducar en {NEAR_EXPIRY_DAYS} días:
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectProduct(item)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
                >
                  <span className="font-medium">{item.name}</span>
                  <ExpiryTag date={item.expiryDate} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {product ? (
        <section className="space-y-3">
          <StepTitle step={2} title="Lote a canjear">
            {loadingLots ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </StepTitle>
          {!loadingLots && lots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Este insumo no tiene existencias con lote registrado.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {lots.map((lot) => {
                const active = lot.id === sourceId;
                return (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => {
                      setSourceId(lot.id);
                      setQuantity(Math.min(1, lot.available));
                    }}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      active ? "border-[#00BFFF] bg-[#00BFFF]/10" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold">{lot.lotNumber}</span>
                      <span className="text-xs text-muted-foreground">{lot.available} disp.</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {lot.warehouseCode} — {lot.locationName}
                    </span>
                    <span className="mt-1 block text-xs">
                      <ExpiryTag date={lot.expiryDate} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {source ? (
        <section className="space-y-3">
          <StepTitle step={3} title="Datos del canje" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Cantidad a canjear (${product?.unit})`} hint={`Disponible en el lote: ${source.available}`}>
              <input
                type="number"
                min={1}
                max={source.available}
                value={quantity || ""}
                onChange={(event) => setQuantity(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                className={inputClass}
              />
            </Field>
            <Field label="Proveedor del canje *">
              <input
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                list="exchange-suppliers"
                placeholder="Nombre del proveedor"
                className={inputClass}
              />
              <datalist id="exchange-suppliers">
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.name} />
                ))}
              </datalist>
            </Field>
            <Field label="Lote nuevo del proveedor *">
              <input
                value={newLot}
                onChange={(event) => setNewLot(event.target.value)}
                placeholder="Número de lote que entrega el proveedor"
                className={inputClass}
              />
            </Field>
            <Field label="Nueva fecha de caducidad *">
              <input
                type="date"
                value={newExpiry}
                onChange={(event) => setNewExpiry(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Nota">
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Folio de canje, autorización del proveedor..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#00BFFF] focus:ring-2 focus:ring-[#00BFFF]/25"
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            La salida del lote caducado y la entrada del lote nuevo se registran en {source.warehouseCode} —{" "}
            {source.locationName}.
          </p>
        </section>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? (
        <div className="space-y-2">
          <Alert tone="success">{message}</Alert>
          {lastFolios.length ? (
            <MovementVoucherActions
              records={() => getMovementsByFolio(lastFolios)}
              warehouses={warehouses}
              variant="button"
              onError={setError}
            />
          ) : null}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={
          !canWrite || submitting || !source || quantity <= 0 || !supplierName.trim() || !newLot.trim() || !newExpiry
        }
        className={primaryButtonClass}
      >
        {submitting ? "Guardando..." : "Registrar canje"}
      </Button>
    </form>
  );
}
