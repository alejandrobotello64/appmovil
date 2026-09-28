"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { QualityPanel } from "@/components/warehouse/quality-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function QualityPage() {
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("calidad") : null;

  return (
    <AppShell
      title="Calidad"
      subtitle="MAS · Encuestas de satisfacción del cliente"
    >
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir el apartado de calidad ni las encuestas de
              satisfacción.
            </p>
          </section>
        ) : allowed ? (
          <QualityPanel />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
