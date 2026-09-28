"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { EducationPanel } from "@/components/warehouse/education-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function EducationPage() {
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("educacion") : null;

  return (
    <AppShell title="Educación" subtitle="MAS · Capacitaciones de especialistas">
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir el módulo de educación y capacitaciones.
            </p>
          </section>
        ) : allowed ? (
          <EducationPanel />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
