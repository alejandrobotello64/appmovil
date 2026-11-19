"use client";
import { Ui } from "@/components/ui/ui-text";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { useLocale } from "@/components/locale-provider";
import { SalesCatalogPanel } from "@/components/documents/document-library-panel";
import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { QuotesPanel } from "@/components/warehouse/quotes-panel";
import { ServiceRequisitionsPanel } from "@/components/warehouse/service-requisitions-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { SALES_TAB_MODULES, SALES_TABS, normalizeSalesTab } from "@/lib/sales/tabs";

export function SalesPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const activeTab = normalizeSalesTab(searchParams.get("tab"));
  const access = useSessionAccess();
  const allowed = access.ready
    ? SALES_TAB_MODULES[activeTab].some((module) => access.canView(module))
    : null;

  const activeMeta = SALES_TABS.find((tab) => tab.id === activeTab);
  const tabTitle =
    activeTab === "dashboard"
      ? t("page.sales")
      : t(`tab.sales.${activeTab}`, activeMeta?.label ?? t("page.sales"));

  return (
    <AppShell
      title={tabTitle}
      subtitle={t("page.salesSubtitle")}
    >
      <div className="space-y-4 sm:space-y-6">
        {allowed === false ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{t("page.noAccess")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("page.noAccessHint")}
            </p>
          </section>
        ) : allowed ? (
          <>
            {activeTab === "dashboard" ? <SalesDashboard /> : null}
            {activeTab === "cotizaciones" ? <QuotesPanel /> : null}
            {activeTab === "surtimientos" ? (
              <ServiceRequisitionsPanel
                source="cotizacion"
                permissionModule="cotizaciones"
                allowFulfill={false}
                title={t("tab.sales.surtimientos")}
                subtitle={activeMeta?.description}
              />
            ) : null}
            {activeTab === "catalogo" ? <SalesCatalogPanel /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground"><Ui>Cargando...</Ui></p>
        )}
      </div>
    </AppShell>
  );
}
