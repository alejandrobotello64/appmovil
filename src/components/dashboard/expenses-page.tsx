"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ExpenseReportsPanel } from "@/components/expenses/expense-reports-panel";
import { ExpenseSummaryPanel } from "@/components/expenses/expense-summary-panel";
import type { ExpenseViewer } from "@/components/expenses/use-expense-reports";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { EXPENSE_TABS, normalizeExpenseTab, tabKind } from "@/lib/expenses/tabs";
import { cn } from "@/lib/utils";

export function ExpensesPage() {
  const searchParams = useSearchParams();
  const tab = normalizeExpenseTab(searchParams.get("tab"));
  const kind = tabKind(tab);
  const { session } = useSessionAccess();
  const permissions = usePermissions("gastos");

  const username = session?.username ?? "";
  const fullName = session?.fullName?.trim() ?? "";
  const viewer = useMemo<ExpenseViewer>(
    () => ({ username, fullName, seeAll: permissions.canApprove }),
    [username, fullName, permissions.canApprove]
  );
  const access = useMemo(
    () => ({
      canCreate: permissions.canCreate,
      canEdit: permissions.canEdit,
      canDelete: permissions.canDelete,
      canExport: permissions.canExport,
      canApprove: permissions.canApprove,
    }),
    [permissions]
  );
  const actor = fullName || username || "usuario";
  const current = EXPENSE_TABS.find((item) => item.id === tab) ?? EXPENSE_TABS[0];

  return (
    <AppShell title="Gastos" subtitle={`MAS · ${current.description}`}>
      <div className="space-y-4 sm:space-y-6">
        {!permissions.ready ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : !permissions.canView ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Sin acceso a este módulo</h2>
            <p className="mt-2 text-sm text-muted-foreground">Tu rol no puede abrir el control de gastos.</p>
          </section>
        ) : (
          <>
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Secciones de gastos">
              {EXPENSE_TABS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
                    item.id === tab
                      ? "border-[#3B46A5] bg-[#3B46A5] font-medium text-white"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {kind ? (
              <ExpenseReportsPanel key={kind} kind={kind} access={access} viewer={viewer} actor={actor} />
            ) : (
              <ExpenseSummaryPanel viewer={viewer} canExport={permissions.canExport} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
