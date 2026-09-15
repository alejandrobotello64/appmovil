"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getInventoryItems,
  getStockStatus,
} from "@/lib/inventory/storage";
import { PRODUCT_CATEGORIES, type InventoryItem } from "@/lib/inventory/types";
import { ModulePlaceholder } from "@/components/warehouse/module-placeholder";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function ReportPanel() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [equipment, setEquipment] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      getInventoryItems({ kind: "producto" }),
      getInventoryItems({ kind: "equipo" }),
    ])
      .then(([products, assets]) => {
        setItems(products);
        setEquipment(assets);
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const value = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const byCategory = PRODUCT_CATEGORIES.map((category) => {
      const categoryItems = items.filter(
        (item) => item.category === category.id
      );
      return {
        label: category.label,
        count: categoryItems.length,
        units: categoryItems.reduce((sum, item) => sum + item.quantity, 0),
        value: categoryItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0
        ),
      };
    }).filter((row) => row.count > 0);

    const alerts = items.filter(
      (item) => getStockStatus(item.quantity, item.minStock) !== "disponible"
    ).length;

    return { value, byCategory, alerts };
  }, [items]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Generando reporte...</p>;
  }

  return (
    <ModulePlaceholder
      title="Reporte del sistema interno"
      description="Separación entre productos consumibles y equipos médicos."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Productos</p>
          <p className="mt-1 text-2xl font-semibold">{items.length}</p>
        </article>
        <article className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Valor productos</p>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(summary.value)}
          </p>
        </article>
        <article className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Alertas stock</p>
          <p className="mt-1 text-2xl font-semibold">{summary.alerts}</p>
        </article>
        <article className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Equipos médicos</p>
          <p className="mt-1 text-2xl font-semibold">{equipment.length}</p>
        </article>
      </div>

      <ResponsiveDataList
        className="mt-5 px-0 md:hidden"
        emptyMessage="Sin categorías con existencias."
        items={summary.byCategory.map((row) => ({
          key: row.label,
          title: row.label,
          fields: [
            { label: "SKUs", value: row.count },
            { label: "Unidades", value: row.units },
            { label: "Valor", value: formatCurrency(row.value) },
          ],
        }))}
      />

      <DesktopTable className="mt-5">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Categoría de producto</th>
              <th className="px-3 py-2 font-medium">SKUs</th>
              <th className="px-3 py-2 font-medium">Unidades</th>
              <th className="px-3 py-2 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {summary.byCategory.map((row) => (
              <tr key={row.label} className="border-t border-border/70">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2">{row.count}</td>
                <td className="px-3 py-2">{row.units}</td>
                <td className="px-3 py-2">{formatCurrency(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DesktopTable>
    </ModulePlaceholder>
  );
}
