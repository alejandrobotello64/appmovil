"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  adjustInventoryQuantity,
  getInventoryItems,
} from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { getSession } from "@/lib/auth";
import { createWarehouseMovement } from "@/lib/warehouse/movements";

type StockMovementPanelProps = {
  mode: "entrada" | "salida";
};

export function StockMovementPanel({ mode }: StockMovementPanelProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void getInventoryItems({ kind: "producto" })
      .then((data) => {
        setItems(data);
        if (data[0]) setItemId(data[0].id);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el inventario."
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => items.find((item) => item.id === itemId) ?? null,
    [items, itemId]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const previousQuantity = selected.quantity;
      const delta = mode === "entrada" ? quantity : -quantity;
      const updated = await adjustInventoryQuantity(selected.id, delta);
      const session = getSession();

      await createWarehouseMovement({
        itemId: selected.id,
        itemSku: selected.sku,
        itemName: selected.name,
        movementType: mode,
        quantity,
        previousQuantity,
        newQuantity: updated.quantity,
        note,
        createdBy: session?.username ?? "",
      });

      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage(
        mode === "entrada"
          ? `Entrada registrada. Nuevo stock: ${updated.quantity} ${updated.unit}.`
          : `Salida registrada. Nuevo stock: ${updated.quantity} ${updated.unit}.`
      );
      setQuantity(1);
      setNote("");
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
      <p className="text-sm text-muted-foreground">Cargando productos...</p>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">
        {mode === "entrada" ? "Registrar entrada" : "Registrar salida"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "entrada"
          ? "Suma unidades a productos consumibles (insumos, medicamentos, etc.)."
          : "Descuenta unidades de productos consumibles. Los equipos médicos no usan este flujo."}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 grid max-w-xl gap-4">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Producto</span>
          <select
            required
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku} — {item.name} ({item.quantity} {item.unit})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Cantidad</span>
          <input
            required
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Nota (opcional)</span>
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Motivo, orden de compra, área que solicita..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
          />
        </label>

        {selected ? (
          <p className="text-sm text-muted-foreground">
            Stock actual:{" "}
            <span className="font-medium text-foreground">
              {selected.quantity} {selected.unit}
            </span>
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
          disabled={submitting || items.length === 0}
          className="w-fit border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
        >
          {submitting
            ? "Guardando..."
            : mode === "entrada"
              ? "Registrar entrada"
              : "Registrar salida"}
        </Button>
      </form>
    </section>
  );
}
