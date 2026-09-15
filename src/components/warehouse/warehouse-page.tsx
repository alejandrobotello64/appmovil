"use client";

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
import { WarehouseTabNav } from "@/components/warehouse/warehouse-tab-nav";
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

  const activeTabMeta = WAREHOUSE_TABS.find((tab) => tab.id === activeTab);

  return (
    <AppShell
      title={activeTabMeta?.label ?? "Almacén"}
      subtitle="MAS · Almacén"
    >
      <WarehouseTabNav />
      <div className="space-y-4 sm:space-y-6">
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

        {activeTab === "pedidos" ? <OrdersPanel /> : null}

        {activeTab === "proveedores" ? <SuppliersPanel /> : null}

        {activeTab === "equipo" ? (
          <InventoryPanel itemKind="equipo" />
        ) : null}

        {activeTab === "mantenimientos" ? <MaintenancesPanel /> : null}

        {activeTab === "reporte" ? <ReportPanel /> : null}

        {activeTab === "usuarios" ? <UsersPanel /> : null}
      </div>
    </AppShell>
  );
}
