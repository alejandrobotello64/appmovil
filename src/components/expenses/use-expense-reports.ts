"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getExpenseReports } from "@/lib/expenses/storage";
import type { ExpenseKind, ExpenseReport } from "@/lib/expenses/types";

export type ExpenseViewer = {
  username: string;
  fullName: string;
  /** Con permiso de aprobar se ven los registros de todos. */
  seeAll: boolean;
};

export function isOwnReport(report: ExpenseReport, viewer: ExpenseViewer) {
  const names = [viewer.username, viewer.fullName].filter(Boolean).map((v) => v.toLowerCase());
  return [report.employeeUsername, report.createdBy].some((v) => v && names.includes(v.toLowerCase()));
}

export function useExpenseReports(kind: ExpenseKind | null, viewer: ExpenseViewer) {
  const key = kind ?? "todos";
  const [state, setState] = useState<{ key: string; reports: ExpenseReport[]; error: string }>({
    key: "",
    reports: [],
    error: "",
  });

  useEffect(() => {
    let cancelled = false;
    void getExpenseReports(kind ? { kind } : {})
      .then((reports) => {
        if (!cancelled) setState({ key, reports, error: "" });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ key, reports: [], error: err instanceof Error ? err.message : "No se pudieron cargar los gastos." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, kind]);

  const reload = useCallback(async () => {
    try {
      const reports = await getExpenseReports(kind ? { kind } : {});
      setState({ key, reports, error: "" });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "No se pudieron cargar los gastos.",
      }));
    }
  }, [key, kind]);

  const visible = useMemo(
    () => (viewer.seeAll ? state.reports : state.reports.filter((report) => isOwnReport(report, viewer))),
    [state.reports, viewer]
  );

  return { reports: visible, loading: state.key !== key, error: state.error, reload };
}
