"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Package,
  PackageX,
  Truck,
  Wrench,
} from "lucide-react";
import {
  getInventoryItems,
  getStockStatus,
} from "@/lib/inventory/storage";
import { PRODUCT_CATEGORIES, type InventoryItem } from "@/lib/inventory/types";
import { getSuppliers } from "@/lib/suppliers/storage";
import type { Supplier } from "@/lib/suppliers/types";
import { getMaintenances } from "@/lib/warehouse/maintenances";
import { getPurchaseOrders } from "@/lib/warehouse/orders";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function WarehouseDashboard() {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [equipment, setEquipment] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [openOrders, setOpenOrders] = useState(0);
  const [pendingMaintenance, setPendingMaintenance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      getInventoryItems({ kind: "producto" }),
      getInventoryItems({ kind: "equipo" }),
      getSuppliers(),
      getPurchaseOrders(),
      getMaintenances(),
    ])
      .then(([productList, equipmentList, supplierList, orders, maintenances]) => {
        setProducts(productList);
        setEquipment(equipmentList);
        setSuppliers(supplierList);
        setOpenOrders(
          orders.filter(
            (order) =>
              order.status !== "recibido" && order.status !== "cancelado"
          ).length
        );
        setPendingMaintenance(
          maintenances.filter(
            (item) =>
              item.status === "programado" || item.status === "en_proceso"
          ).length
        );
      })
      .catch((error) => console.error(error))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const totalUnits = products.reduce((sum, item) => sum + item.quantity, 0);
    const inventoryValue = products.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const lowStock = products.filter(
      (item) => getStockStatus(item.quantity, item.minStock) === "bajo_stock"
    ).length;
    const outOfStock = products.filter(
      (item) => getStockStatus(item.quantity, item.minStock) === "agotado"
    ).length;
    const operativeEquipment = equipment.filter(
      (item) => item.assetStatus === "operativo"
    ).length;
    const activeSuppliers = suppliers.filter((item) => item.isActive).length;
    const categoriesUsed = PRODUCT_CATEGORIES.filter((category) =>
      products.some((item) => item.category === category.id)
    ).length;

    return {
      totalProducts: products.length,
      totalUnits,
      inventoryValue,
      lowStock,
      outOfStock,
      equipment: equipment.length,
      operativeEquipment,
      activeSuppliers,
      categoriesUsed,
      openOrders,
      pendingMaintenance,
    };
  }, [products, equipment, suppliers, openOrders, pendingMaintenance]);

  const alerts = useMemo(
    () =>
      products.filter(
        (item) => getStockStatus(item.quantity, item.minStock) !== "disponible"
      ),
    [products]
  );

  const cards = [
    {
      label: "Productos consumibles",
      value: stats.totalProducts,
      icon: Package,
      href: "/dashboard/almacen?tab=productos",
      tone: "text-[#3B46A5]",
    },
    {
      label: "Unidades en stock",
      value: stats.totalUnits,
      icon: Boxes,
      href: "/dashboard/almacen?tab=productos",
      tone: "text-[#00BFFF]",
    },
    {
      label: "Valor de productos",
      value: formatCurrency(stats.inventoryValue),
      icon: ClipboardList,
      href: "/dashboard/almacen?tab=reporte",
      tone: "text-emerald-600",
    },
    {
      label: "Bajo stock",
      value: stats.lowStock,
      icon: AlertTriangle,
      href: "/dashboard/almacen?tab=productos",
      tone: "text-amber-600",
    },
    {
      label: "Agotados",
      value: stats.outOfStock,
      icon: PackageX,
      href: "/dashboard/almacen?tab=productos",
      tone: "text-destructive",
    },
    {
      label: "Equipos médicos",
      value: `${stats.operativeEquipment}/${stats.equipment}`,
      icon: Wrench,
      href: "/dashboard/almacen?tab=equipo",
      tone: "text-[#3B46A5]",
    },
    {
      label: "Pedidos abiertos",
      value: stats.openOrders,
      icon: ClipboardList,
      href: "/dashboard/almacen?tab=pedidos",
      tone: "text-[#00BFFF]",
    },
    {
      label: "Mantenimientos pendientes",
      value: stats.pendingMaintenance,
      icon: Wrench,
      href: "/dashboard/almacen?tab=mantenimientos",
      tone: "text-amber-600",
    },
    {
      label: "Proveedores activos",
      value: stats.activeSuppliers,
      icon: Truck,
      href: "/dashboard/almacen?tab=proveedores",
      tone: "text-[#00BFFF]",
    },
  ];

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Cargando dashboard del sistema interno...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-[linear-gradient(135deg,rgba(0,191,255,0.08),rgba(59,70,165,0.12))] p-6">
        <p className="text-sm text-muted-foreground">Sistema interno de almacén</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Dashboard operativo
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Separa el control de <strong>productos consumibles</strong> (insumos,
          medicamentos, refacciones) del control de{" "}
          <strong>equipos médicos</strong> (activos con serie y mantenimiento).
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {card.value}
                  </p>
                </div>
                <div className="rounded-xl bg-muted p-2.5">
                  <Icon className={`size-5 ${card.tone}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold text-foreground">
          Alertas de productos consumibles
        </h3>
        {alerts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay insumos o medicamentos con stock bajo o agotado.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {alerts.slice(0, 8).map((item) => {
              const status = getStockStatus(item.quantity, item.minStock);
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.category} · {item.quantity} {item.unit}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {status === "agotado" ? "Agotado" : "Bajo stock"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
