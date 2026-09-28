"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { CalendarPanel } from "@/components/warehouse/calendar-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function CalendarPage() {
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("calendario") : null;

  return (
    <AppShell title="Calendario" subtitle="MAS · Agenda">
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede abrir el calendario operativo.
            </p>
          </section>
        ) : allowed ? (
          <CalendarPanel />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
