"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { useLocale } from "@/components/locale-provider";
import { FleetPanel } from "@/components/warehouse/fleet-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function FleetPage() {
  const { t } = useLocale();
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("flotilla") : null;

  return (
    <AppShell title={t("page.fleet")} subtitle={t("page.fleetSubtitle")}>
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("page.noAccess")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("page.noAccessHint")}
            </p>
          </section>
        ) : allowed ? (
          <FleetPanel />
        ) : (
          <p className="text-sm text-muted-foreground">{t("ui.loading")}</p>
        )}
      </div>
    </AppShell>
  );
}
