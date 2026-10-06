"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ComprasDashboard } from "@/components/compras/compras-dashboard";
import { PurchaseRequestsPanel } from "@/components/compras/purchase-requests-panel";
import { OrdersPanel } from "@/components/warehouse/orders-panel";
import { SuppliersPanel } from "@/components/warehouse/suppliers-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import {
  COMPRAS_TAB_MODULES,
  COMPRAS_TABS,
  normalizeComprasTab,
} from "@/lib/compras/tabs";

export function ComprasPage() {
  const searchParams = useSearchParams();
  const activeTab = normalizeComprasTab(searchParams.get("tab"));
  const access = useSessionAccess();
  const allowed = access.ready
    ? COMPRAS_TAB_MODULES[activeTab].some((module) => access.canView(module))
    : null;
  const activeMeta = COMPRAS_TABS.find((tab) => tab.id === activeTab);

  return (
    <AppShell
      title={activeTab === "dashboard" ? "Compras" : activeMeta?.label ?? "Compras"}
      subtitle={activeMeta?.description ?? "MAS · Compras"}
    >
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tus permisos no incluyen {activeMeta?.label ?? "esta sección"}. Elige
              otra opción del menú de compras.
            </p>
          </section>
        ) : allowed ? (
          <>
            {activeTab === "dashboard" ? <ComprasDashboard /> : null}
            {activeTab === "solicitudes" ? (
              <PurchaseRequestsPanel mode="compras" />
            ) : null}
            {activeTab === "pedidos" ? <OrdersPanel /> : null}
            {activeTab === "proveedores" ? <SuppliersPanel /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
