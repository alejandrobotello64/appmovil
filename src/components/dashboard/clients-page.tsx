"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { ClientsPanel } from "@/components/warehouse/clients-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function ClientsPage() {
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("clientes") : null;

  return (
    <AppShell title="Clientes" subtitle="MAS · Clientes">
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir clientes y levantamientos.
            </p>
          </section>
        ) : allowed ? (
          <ClientsPanel />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
