"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { SalesCatalogPanel } from "@/components/documents/document-library-panel";
import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { QuotesPanel } from "@/components/warehouse/quotes-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { SALES_TAB_MODULES, SALES_TABS, normalizeSalesTab } from "@/lib/sales/tabs";

export function SalesPage() {
  const searchParams = useSearchParams();
  const activeTab = normalizeSalesTab(searchParams.get("tab"));
  const access = useSessionAccess();
  const allowed = access.ready
    ? SALES_TAB_MODULES[activeTab].some((module) => access.canView(module))
    : null;

  const activeMeta = SALES_TABS.find((tab) => tab.id === activeTab);

  return (
    <AppShell
      title={activeTab === "dashboard" ? "Ventas" : activeMeta?.label ?? "Ventas"}
      subtitle={activeMeta?.description ?? "MAS · Ventas"}
    >
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tus permisos no incluyen {activeMeta?.label ?? "esta sección"}. Elige
              otra opción del menú de ventas.
            </p>
          </section>
        ) : allowed ? (
          <>
            {activeTab === "dashboard" ? <SalesDashboard /> : null}
            {activeTab === "cotizaciones" ? <QuotesPanel /> : null}
            {activeTab === "catalogo" ? <SalesCatalogPanel /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
