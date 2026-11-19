"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getInventoryItems,
  itemShowsStockAlert,
} from "@/lib/inventory/storage";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { PRODUCT_CATEGORIES, type InventoryItem } from "@/lib/inventory/types";
import { ModulePlaceholder } from "@/components/warehouse/module-placeholder";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { SortableTable } from "@/components/ui/sortable-table";
import { useLocale } from "@/components/locale-provider";
import { localeTag } from "@/lib/i18n/messages";

function formatCurrency(value: number, locale: "es" | "en") {
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function ReportPanel() {
  const { t, locale } = useLocale();
  const { can } = useSessionAccess();
  const canViewPrices = can("precios.view");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [equipment, setEquipment] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      getInventoryItems({ kind: "producto" }),
      getInventoryItems({ kind: "equipo" }),
    ])
      .then(([products, assets]) => {
        setItems(products);
        setEquipment(assets);
      })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const value = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const byCategory = PRODUCT_CATEGORIES.map((category) => {
      const categoryItems = items.filter(
        (item) => item.category === category.id
      );
      return {
        label: category.label,
        count: categoryItems.length,
        units: categoryItems.reduce((sum, item) => sum + item.quantity, 0),
        value: categoryItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0
        ),
      };
    }).filter((row) => row.count > 0);

    const alerts = items.filter((item) => itemShowsStockAlert(item)).length;

    return { value, byCategory, alerts };
  }, [items]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("report.generating")}</p>
    );
  }

  return (
    <ModulePlaceholder
      title={t("report.title")}
      description={t("report.description")}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">{t("ui.products")}</p>
          <p className="mt-1 text-2xl font-semibold">{items.length}</p>
        </article>
        {canViewPrices ? (
          <article className="rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">
              {t("report.productValue")}
            </p>
            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(summary.value, locale)}
            </p>
          </article>
        ) : null}
        <article className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {t("report.stockAlerts")}
          </p>
          <p className="mt-1 text-2xl font-semibold">{summary.alerts}</p>
        </article>
        <article className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {t("report.medicalEquipment")}
          </p>
          <p className="mt-1 text-2xl font-semibold">{equipment.length}</p>
        </article>
      </div>

      <ResponsiveDataList
        className="mt-5 px-0 md:hidden"
        emptyMessage={t("report.emptyCategories")}
        items={summary.byCategory.map((row) => ({
          key: row.label,
          title: row.label,
          fields: [
            { label: t("ui.sku") + "s", value: row.count },
            { label: t("ui.units"), value: row.units },
            ...(canViewPrices
              ? [
                  {
                    label: t("ui.value"),
                    value: formatCurrency(row.value, locale),
                  },
                ]
              : []),
          ],
        }))}
      />

      <DesktopTable className="mt-5">
        <SortableTable className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t("report.productCategory")}
              </th>
              <th className="px-3 py-2 font-medium">{t("ui.sku")}s</th>
              <th className="px-3 py-2 font-medium">{t("ui.units")}</th>
              {canViewPrices ? (
                <th className="px-3 py-2 font-medium">{t("ui.value")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {summary.byCategory.map((row) => (
              <tr key={row.label} className="border-t border-border/70">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2">{row.count}</td>
                <td className="px-3 py-2">{row.units}</td>
                {canViewPrices ? (
                  <td className="px-3 py-2">
                    {formatCurrency(row.value, locale)}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </SortableTable>
      </DesktopTable>
    </ModulePlaceholder>
  );
}
