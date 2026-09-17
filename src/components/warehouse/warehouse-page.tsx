"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { InventoryPanel } from "@/components/inventory/inventory-panel";
import { WarehouseDashboard } from "@/components/warehouse/warehouse-dashboard";
import { StockMovementPanel } from "@/components/warehouse/stock-movement-panel";
import { SuppliersPanel } from "@/components/warehouse/suppliers-panel";
import { MovementsPanel } from "@/components/warehouse/movements-panel";
import { OrdersPanel } from "@/components/warehouse/orders-panel";
import { MaintenancesPanel } from "@/components/warehouse/maintenances-panel";
import { CalendarPanel } from "@/components/warehouse/calendar-panel";
import { ReportPanel } from "@/components/warehouse/report-panel";
import { KardexPanel } from "@/components/warehouse/kardex-panel";
import { getSession } from "@/lib/auth";
import { canViewModule, type WarehouseModule } from "@/lib/auth/permissions";
import {
  WAREHOUSE_TABS,
  normalizeWarehouseTab,
  type WarehouseTabId,
} from "@/lib/warehouse/tabs";
import type { SupplyCategoryId } from "@/lib/inventory/types";

const SUPPLY_TABS: SupplyCategoryId[] = [
  "insumos",
  "medicamentos",
  "refacciones",
  "accesorios",
  "reactivos",
];

export function WarehousePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: WarehouseTabId = normalizeWarehouseTab(tabParam) ?? "dashboard";
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(getSession()?.role ?? "direccion");
  }, []);

  useEffect(() => {
    if (tabParam === "usuarios") {
      router.replace("/dashboard/usuarios");
    }
  }, [tabParam, router]);

  const activeTabMeta = WAREHOUSE_TABS.find((tab) => tab.id === activeTab);
  const allowed =
    role === null || canViewModule(role, activeTab as WarehouseModule);
  const supplyTab = SUPPLY_TABS.includes(activeTab as SupplyCategoryId)
    ? (activeTab as SupplyCategoryId)
    : null;

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

            {supplyTab ? <InventoryPanel panelMode={supplyTab} /> : null}

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
              <InventoryPanel panelMode="equipment" />
            ) : null}

            {activeTab === "mantenimientos" ? <MaintenancesPanel /> : null}

            {activeTab === "calendario" ? <CalendarPanel /> : null}

            {activeTab === "reporte" ? <ReportPanel /> : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
