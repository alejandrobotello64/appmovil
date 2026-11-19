"use client";
import { Ui } from "@/components/ui/ui-text";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { useLocale } from "@/components/locale-provider";
import { UsersPanel } from "@/components/warehouse/users-panel";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { normalizeUsersTab, USERS_TABS } from "@/lib/users/tabs";

export function UsersPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const activeTab = normalizeUsersTab(searchParams.get("tab"));
  const editUserId = searchParams.get("id");
  const activeTabMeta = USERS_TABS.find((tab) => tab.id === activeTab);
  const access = useSessionAccess();
  const allowed = access.ready ? access.canView("usuarios") : null;

  return (
    <AppShell
      title={t(`tab.users.${activeTab}`, activeTabMeta?.label ?? t("page.users"))}
      subtitle={t("page.usersSubtitle")}
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
          <UsersPanel activeTab={activeTab} editUserId={editUserId} />
        ) : (
          <p className="text-sm text-muted-foreground"><Ui>Cargando...</Ui></p>
        )}
      </div>
    </AppShell>
  );
}
