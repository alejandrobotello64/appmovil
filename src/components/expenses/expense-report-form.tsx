"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  createExpenseReport,
  listExpenseEmployees,
  updateExpenseReport,
  type ExpenseEmployee,
} from "@/lib/expenses/storage";
import {
  expenseKindMeta,
  todayIso,
  type ExpenseKind,
  type ExpenseReport,
  type ExpenseReportInput,
} from "@/lib/expenses/types";
import { Field, inputClass } from "./expense-ui";

function monthBounds() {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { start: `${today.slice(0, 7)}-01`, end: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

function emptyInput(kind: ExpenseKind, employee: { name: string; username: string }): ExpenseReportInput {
  const meta = expenseKindMeta(kind);
  const month = monthBounds();
  return {
    kind,
    title: "",
    employeeName: employee.name,
    employeeUsername: employee.username,
    department: "",
    purpose: "",
    destination: "",
    clientName: "",
    startDate: meta.isTrip ? todayIso() : month.start,
    endDate: meta.isTrip ? todayIso() : month.end,
    advanceAmount: 0,
    notes: "",
  };
}

function inputFromReport(report: ExpenseReport): ExpenseReportInput {
  return {
    kind: report.kind,
    title: report.title,
    employeeName: report.employeeName,
    employeeUsername: report.employeeUsername,
    department: report.department,
    purpose: report.purpose,
    destination: report.destination,
    clientName: report.clientName,
    startDate: report.startDate,
    endDate: report.endDate,
    advanceAmount: report.advanceAmount,
    notes: report.notes,
  };
}

type Props = {
  kind: ExpenseKind;
  report?: ExpenseReport | null;
  actor: string;
  currentUser: { name: string; username: string };
  /** Sin permiso de aprobar solo se registra a sí mismo. */
  canChooseEmployee: boolean;
  onClose: () => void;
  onSaved: (report: ExpenseReport | null) => void;
};

export function ExpenseReportForm({
  kind,
  report,
  actor,
  currentUser,
  canChooseEmployee,
  onClose,
  onSaved,
}: Props) {
  const meta = expenseKindMeta(report?.kind ?? kind);
  const [form, setForm] = useState<ExpenseReportInput>(() =>
    report ? inputFromReport(report) : emptyInput(kind, currentUser)
  );
  const [employees, setEmployees] = useState<ExpenseEmployee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listExpenseEmployees()
      .then((rows) => {
        if (cancelled) return;
        setEmployees(rows);
        if (!report) {
          const me = rows.find((row) => row.username === currentUser.username);
          if (me?.department) setForm((prev) => (prev.department ? prev : { ...prev, department: me.department }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [report, currentUser.username]);

  function patch(values: Partial<ExpenseReportInput>) {
    setForm((prev) => ({ ...prev, ...values }));
  }

  function chooseEmployee(username: string) {
    const employee = employees.find((row) => row.username === username);
    if (!employee) return;
    patch({
      employeeUsername: employee.username,
      employeeName: employee.fullName,
      department: employee.department || form.department,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (report) {
        await updateExpenseReport(report.id, form, actor);
        onSaved(null);
      } else {
        onSaved(await createExpenseReport(form, actor));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setSaving(false);
    }
  }

  const employeeInList = employees.some((row) => row.username === form.employeeUsername);

  return (
    <ModalShell
      title={report ? `Editar ${report.folio}` : `Nuevo registro · ${meta.label}`}
      description={meta.description}
      headerAction={
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {meta.isTrip ? (
            <>
              <Field label="Destino *">
                <input
                  className={inputClass}
                  value={form.destination}
                  onChange={(e) => patch({ destination: e.target.value })}
                  placeholder="Ciudad / estado"
                  autoFocus
                />
              </Field>
              <Field label="Cliente o institución">
                <input
                  className={inputClass}
                  value={form.clientName}
                  onChange={(e) => patch({ clientName: e.target.value })}
                  placeholder="Hospital, cliente o evento"
                />
              </Field>
            </>
          ) : (
            <Field label="Título *" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder={
                  kind === "caja_chica"
                    ? "Ej. Caja chica oficina — quincena 1"
                    : kind === "corriente"
                      ? "Ej. Gastos de operación de octubre"
                      : "Descripción del registro"
                }
                autoFocus
              />
            </Field>
          )}

          <Field label="Responsable *">
            {canChooseEmployee && employees.length ? (
              <select
                className={inputClass}
                value={employeeInList ? form.employeeUsername : ""}
                onChange={(e) => chooseEmployee(e.target.value)}
              >
                {!employeeInList ? <option value="">{form.employeeName || "Selecciona…"}</option> : null}
                {employees.map((row) => (
                  <option key={row.username} value={row.username}>
                    {row.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <input className={inputClass} value={form.employeeName} disabled />
            )}
          </Field>
          <Field label="Área / departamento">
            <input
              className={inputClass}
              value={form.department}
              onChange={(e) => patch({ department: e.target.value })}
            />
          </Field>

          <Field label={meta.isTrip ? "Salida *" : "Periodo desde *"}>
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) =>
                patch({
                  startDate: e.target.value,
                  endDate: form.endDate < e.target.value ? e.target.value : form.endDate,
                })
              }
            />
          </Field>
          <Field label={meta.isTrip ? "Regreso *" : "Periodo hasta *"}>
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => patch({ endDate: e.target.value })}
            />
          </Field>

          {meta.advanceLabel ? (
            <Field
              label={meta.advanceLabel}
              hint={
                kind === "caja_chica"
                  ? "Monto del fondo que se comprueba en este corte."
                  : "Dinero entregado al colaborador antes del gasto."
              }
            >
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.advanceAmount || ""}
                onChange={(e) => patch({ advanceAmount: Number(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </Field>
          ) : null}

          <Field
            label={meta.isTrip ? "Objetivo del viaje" : "Descripción / justificación"}
            className={meta.advanceLabel ? "" : "sm:col-span-2"}
          >
            <input
              className={inputClass}
              value={form.purpose}
              onChange={(e) => patch({ purpose: e.target.value })}
              placeholder={meta.isTrip ? "Instalación, servicio, capacitación…" : ""}
            />
          </Field>

          <Field label="Notas" className="sm:col-span-2">
            <textarea
              className={`${inputClass} h-20 py-2`}
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </Field>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {report ? "Guardar cambios" : "Crear registro"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
