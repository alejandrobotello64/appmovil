"use client";

import { AppShell } from "@/components/dashboard/app-shell";
import { useLocale } from "@/components/locale-provider";
import { EducationPanel } from "@/components/warehouse/education-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";

export function EducationPage() {
  const { t } = useLocale();
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("educacion") : null;

  return (
    <AppShell title={t("page.education")} subtitle={t("page.educationSubtitle")}>
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("page.noAccess")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("page.noAccessHint")}
            </p>
          </section>
        ) : allowed ? (
          <EducationPanel />
        ) : (
          <p className="text-sm text-muted-foreground">{t("ui.loading")}</p>
        )}
      </div>
    </AppShell>
  );
}
