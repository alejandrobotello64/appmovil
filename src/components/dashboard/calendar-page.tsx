"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { useLocale } from "@/components/locale-provider";
import { CalendarPanel } from "@/components/warehouse/calendar-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function CalendarPage() {
  const { t } = useLocale();
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("calendario") : null;

  return (
    <AppShell title={t("page.calendar")} subtitle={t("page.calendarSubtitle")}>
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("page.noAccess")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("page.noAccessHint")}
            </p>
          </section>
        ) : allowed ? (
          <CalendarPanel />
        ) : (
          <p className="text-sm text-muted-foreground">{t("ui.loading")}</p>
        )}
      </div>
    </AppShell>
  );
}
