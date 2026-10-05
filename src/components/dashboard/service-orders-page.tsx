"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { BiomedicalInstrumentsPanel } from "@/components/warehouse/biomedical-instruments-panel";
import { ChecklistTemplatesPanel } from "@/components/warehouse/checklist-templates-panel";
import { ServiceOrdersDashboard } from "@/components/warehouse/service-orders-dashboard";
import { ServiceOrdersPanel } from "@/components/warehouse/service-orders-panel";
import { ServicePasswordsPanel } from "@/components/warehouse/service-passwords-panel";
import { TechnicalDocumentsPanel } from "@/components/documents/document-library-panel";
import { ServiceRequisitionsPanel } from "@/components/warehouse/service-requisitions-panel";
import { BiomedicalToolRequestsPanel } from "@/components/tools/tools-module";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import {
  normalizeServiceOrderTab,
  SERVICE_ORDER_TAB_MODULE,
  SERVICE_ORDER_TABS,
} from "@/lib/service-orders/tabs";

export function ServiceOrdersPage() {
  const searchParams = useSearchParams();
  const activeTab = normalizeServiceOrderTab(searchParams.get("tab"));
  const access = useSessionAccess();
  const allowed = access.ready
    ? access.canView(SERVICE_ORDER_TAB_MODULE[activeTab])
    : null;

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
              Tus permisos no incluyen {activeMeta?.label ?? "esta sección"}.
              Elige otra opción del menú de biomédica.
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
                source="orden_servicio"
                permissionModule="ordenes_servicio"
                allowFulfill={false}
                title="Pedidos a almacén"
                subtitle="Insumos y refacciones solicitados desde las órdenes de servicio. El surtido lo confirma almacén."
              />
            ) : null}
            {activeTab === "herramientas" ? <BiomedicalToolRequestsPanel /> : null}
            {activeTab === "plantillas" ? <ChecklistTemplatesPanel /> : null}
            {activeTab === "documentos" ? <TechnicalDocumentsPanel /> : null}
            {activeTab === "contrasenas" ? <ServicePasswordsPanel /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
