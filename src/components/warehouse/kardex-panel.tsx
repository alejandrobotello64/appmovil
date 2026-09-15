"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { getKardex, type KardexRow } from "@/lib/warehouse/stock";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  traspaso: "Traspaso",
  devolucion: "Devolución",
  ajuste: "Ajuste",
  cambio_ubicacion: "Ubicación",
  canje_caducado: "Canje",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function KardexPanel() {
  const [rows, setRows] = useState<KardexRow[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [productId, setProductId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([getKardex(), getInventoryItems()])
      .then(([kardex, items]) => {
        setRows(kardex);
        setProducts(items);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudo cargar el kardex.")
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (productId === "all") return rows;
    const sku = products.find((item) => item.id === productId)?.sku;
    return rows.filter((row) => row.productSku === sku);
  }, [rows, productId, products]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando kardex...</p>;
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Kardex</h2>
          <p className="text-sm text-muted-foreground">
            Movimientos inalterables con folio. La existencia solo cambia por
            estos documentos.
          </p>
        </div>
        <select
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos los productos</option>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.sku} — {item.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ResponsiveDataList
        emptyMessage="Aún no hay movimientos de kardex."
        items={filtered.map((row) => ({
          key: row.id,
          title: row.productName,
          subtitle: row.folio,
          badge: (
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
              {TYPE_LABELS[row.movementType] ?? row.movementType}
            </span>
          ),
          fields: [
            {
              label: "Fecha",
              value: new Date(row.occurredAt).toLocaleString("es-MX"),
            },
            { label: "Entrada", value: String(row.qtyIn) },
            { label: "Salida", value: String(row.qtyOut) },
            { label: "Existencia", value: String(row.resultingQty) },
            { label: "Usuario", value: row.createdBy || "—" },
          ],
        }))}
      />

      <DesktopTable>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Entrada</th>
              <th className="px-4 py-3 font-medium">Salida</th>
              <th className="px-4 py-3 font-medium">Existencia</th>
              <th className="px-4 py-3 font-medium">Costo</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Aún no hay movimientos de kardex.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-border/70">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(row.occurredAt).toLocaleString("es-MX")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.folio}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                        row.qtyIn > 0 && row.qtyOut === 0
                          ? "bg-emerald-500/10 text-emerald-700"
                          : row.qtyOut > 0 && row.qtyIn === 0
                            ? "bg-amber-500/10 text-amber-700"
                            : "bg-sky-500/10 text-sky-700"
                      )}
                    >
                      {TYPE_LABELS[row.movementType] ?? row.movementType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.productSku}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.qtyIn || "—"}</td>
                  <td className="px-4 py-3">{row.qtyOut || "—"}</td>
                  <td className="px-4 py-3 font-medium">{row.resultingQty}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCurrency(row.unitCost * Math.max(row.qtyIn, row.qtyOut))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.createdBy || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </DesktopTable>
    </section>
  );
}
