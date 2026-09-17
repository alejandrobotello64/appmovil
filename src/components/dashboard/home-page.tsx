"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Package } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { InventoryStats } from "@/components/inventory/inventory-stats";
import {
  getInventoryItems,
  getStockStatus,
} from "@/lib/inventory/storage";
import { CATALOG_CATEGORIES, type InventoryItem } from "@/lib/inventory/types";

export function DashboardHomePage() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    void getInventoryItems()
      .then(setItems)
      .catch((error) => {
        console.error("Error loading dashboard inventory:", error);
      });
  }, []);

  const alerts = items.filter(
    (item) => getStockStatus(item.quantity, item.minStock) !== "disponible"
  );

  return (
    <AppShell title="Panel principal" subtitle="Medical Advanced Supplies">
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-[linear-gradient(135deg,rgba(0,191,255,0.08),rgba(59,70,165,0.12))] p-6">
          <p className="text-sm text-muted-foreground">Bienvenido al sistema</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Gestión de inventario médico
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Controla insumos, refacciones, medicamentos, accesorios, equipos y
            reactivos desde un solo panel.
          </p>
          <div className="mt-4">
            <Link
              href="/dashboard/almacen?tab=dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Ir al almacén
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <InventoryStats items={items} />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              <h3 className="font-semibold text-foreground">Alertas de stock</h3>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay productos con stock bajo o agotado.
              </p>
            ) : (
              <ul className="space-y-3">
                {alerts.slice(0, 5).map((item) => {
                  const status = getStockStatus(item.quantity, item.minStock);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 rounded-xl border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.unit} · mín. {item.minStock}
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

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Package className="size-5 text-[#3B46A5]" />
              <h3 className="font-semibold text-foreground">
                Categorías del inventario
              </h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CATALOG_CATEGORIES.map((category) => {
                const count = items.filter(
                  (item) => item.category === category.id
                ).length;
                return (
                  <Link
                    key={category.id}
                    href={
                      category.id === "equipos"
                        ? "/dashboard/almacen?tab=equipo"
                        : `/dashboard/almacen?tab=${category.id}`
                    }
                    className="rounded-xl border border-border/70 px-3 py-3 transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {category.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#00BFFF]">
                      {count}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
