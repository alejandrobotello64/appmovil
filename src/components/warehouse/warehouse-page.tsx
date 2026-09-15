"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { InventoryPanel } from "@/components/inventory/inventory-panel";
import { WarehouseDashboard } from "@/components/warehouse/warehouse-dashboard";
import { StockMovementPanel } from "@/components/warehouse/stock-movement-panel";
import { SuppliersPanel } from "@/components/warehouse/suppliers-panel";
import { MovementsPanel } from "@/components/warehouse/movements-panel";
import { OrdersPanel } from "@/components/warehouse/orders-panel";
import { MaintenancesPanel } from "@/components/warehouse/maintenances-panel";
import { ReportPanel } from "@/components/warehouse/report-panel";
import { UsersPanel } from "@/components/warehouse/users-panel";
import { KardexPanel } from "@/components/warehouse/kardex-panel";
import { getSession } from "@/lib/auth";
import { canViewModule, type WarehouseModule } from "@/lib/auth/permissions";
import {
  WAREHOUSE_TABS,
  isWarehouseTabId,
  type WarehouseTabId,
} from "@/lib/warehouse/tabs";

export function WarehousePage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const categoryParam = searchParams.get("category");
  const activeTab: WarehouseTabId = isWarehouseTabId(tabParam)
    ? tabParam
    : "dashboard";
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getSession()?.role ?? "direccion");
  }, []);

  const activeTabMeta = WAREHOUSE_TABS.find((tab) => tab.id === activeTab);
  const allowed =
    role === null || canViewModule(role, activeTab as WarehouseModule);

  return (
    <AppShell
      title={activeTabMeta?.label ?? "Almacén"}
      subtitle="MAS · Almacén"
    >
      <div className="space-y-4 sm:space-y-6">
        {!allowed ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir {activeTabMeta?.label ?? "esta sección"}.
              Elige otra opción del menú de almacén.
            </p>
          </section>
        ) : (
          <>
            {activeTab === "dashboard" ? <WarehouseDashboard /> : null}

            {activeTab === "productos" ? (
              <InventoryPanel
                catalogMode
                initialCategory={categoryParam}
              />
            ) : null}

            {activeTab === "entradas" ? (
              <StockMovementPanel mode="entrada" />
            ) : null}

            {activeTab === "salidas" ? (
              <StockMovementPanel mode="salida" />
            ) : null}

            {activeTab === "movimientos" ? <MovementsPanel /> : null}

            {activeTab === "kardex" ? <KardexPanel /> : null}

            {activeTab === "pedidos" ? <OrdersPanel /> : null}

            {activeTab === "proveedores" ? <SuppliersPanel /> : null}

            {activeTab === "equipo" ? (
              <InventoryPanel itemKind="equipo" />
            ) : null}

            {activeTab === "mantenimientos" ? <MaintenancesPanel /> : null}

            {activeTab === "reporte" ? <ReportPanel /> : null}

            {activeTab === "usuarios" ? <UsersPanel /> : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
