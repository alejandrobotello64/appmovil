"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { TendersPanel } from "@/components/warehouse/tenders-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function TendersPage() {
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("licitaciones") : null;

  return (
    <AppShell title="Licitaciones" subtitle="MAS · CompraMX y contratos">
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir licitaciones.
            </p>
          </section>
        ) : allowed ? (
          <TendersPanel />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
