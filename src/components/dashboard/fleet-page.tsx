"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { FleetPanel } from "@/components/warehouse/fleet-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function FleetPage() {
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("flotilla") : null;

  return (
    <AppShell title="Flotilla" subtitle="MAS · Vehículos de la empresa">
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir el monitoreo de flotilla.
            </p>
          </section>
        ) : allowed ? (
          <FleetPanel />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
