"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { UsersPanel } from "@/components/warehouse/users-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { normalizeUsersTab, USERS_TABS } from "@/lib/users/tabs";

export function UsersPage() {
  const searchParams = useSearchParams();
  const activeTab = normalizeUsersTab(searchParams.get("tab"));
  const editUserId = searchParams.get("id");
  const activeTabMeta = USERS_TABS.find((tab) => tab.id === activeTab);
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("usuarios") : null;

  return (
    <AppShell
      title={activeTabMeta?.label ?? "Usuarios"}
      subtitle="MAS · Administración"
    >
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu rol no puede administrar usuarios del sistema.
            </p>
          </section>
        ) : allowed ? (
          <UsersPanel activeTab={activeTab} editUserId={editUserId} />
        ) : (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}
      </div>
    </AppShell>
  );
}
