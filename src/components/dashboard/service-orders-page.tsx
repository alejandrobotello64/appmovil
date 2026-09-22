"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { BiomedicalInstrumentsPanel } from "@/components/warehouse/biomedical-instruments-panel";
import { ChecklistTemplatesPanel } from "@/components/warehouse/checklist-templates-panel";
import { ServiceOrdersDashboard } from "@/components/warehouse/service-orders-dashboard";
import { ServiceOrdersPanel } from "@/components/warehouse/service-orders-panel";
import { ServiceRequisitionsPanel } from "@/components/warehouse/service-requisitions-panel";
import { getSession } from "@/lib/auth";
import { canViewModule } from "@/lib/auth/permissions";
import {
  normalizeServiceOrderTab,
  SERVICE_ORDER_TABS,
} from "@/lib/service-orders/tabs";

export function ServiceOrdersPage() {
  const searchParams = useSearchParams();
  const activeTab = normalizeServiceOrderTab(searchParams.get("tab"));
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const role = getSession()?.role ?? "direccion";
    setAllowed(canViewModule(role, "ordenes_servicio"));
  }, []);

  const activeMeta = SERVICE_ORDER_TABS.find((tab) => tab.id === activeTab);

  return (
    <AppShell
      title={activeMeta?.label ?? "Biomédica"}
      subtitle={activeMeta?.description ?? "MAS · Servicio técnico"}
    >
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir biomédica / órdenes de servicio.
            </p>
          </section>
        ) : allowed ? (
          <>
            {activeTab === "dashboard" ? <ServiceOrdersDashboard /> : null}
            {activeTab === "ordenes" ? (
              <ServiceOrdersPanel
                initialOrderId={searchParams.get("order")}
              />
            ) : null}
            {activeTab === "instrumentos" ? (
              <BiomedicalInstrumentsPanel />
            ) : null}
            {activeTab === "solicitudes" ? (
              <ServiceRequisitionsPanel
                permissionModule="ordenes_servicio"
                allowFulfill={false}
                title="Pedidos a almacén"
                subtitle="Insumos y refacciones solicitados desde las órdenes de servicio. El surtido lo confirma almacén."
              />
            ) : null}
            {activeTab === "plantillas" ? <ChecklistTemplatesPanel /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
