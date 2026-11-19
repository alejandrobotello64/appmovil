"use client";
import { Ui } from "@/components/ui/ui-text";

import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCode2,
  FileDown,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { exportExpenseReportPdf, type PdfOutput } from "@/lib/expenses/pdf";
import { openStoredFileOnMobile } from "@/lib/print/open-pdf";
import { deleteExpenseItem, setExpenseReportStatus, updateExpenseItemDate } from "@/lib/expenses/storage";
import {
  balanceLabel,
  categoryColor,
  categoryLabel,
  categoryTotals,
  expenseKindMeta,
  formatDate,
  formatMoney,
  isReportEditable,
  itemHasInvoice,
  paymentMethodLabel,
  reportBalance,
  reportDays,
  reportTitle,
  type ExpenseItem,
  type ExpenseReport,
  type ExpenseStatus,
} from "@/lib/expenses/types";
import { cn } from "@/lib/utils";
import { ExpenseItemForm } from "./expense-item-form";
import { ExpenseTripChart } from "./expense-trip-chart";
import { CategoryBars, CategoryDot, KpiCard, ReceiptFileLink, StatusBadge, inputClass } from "./expense-ui";

type ItemSort = "fecha" | "categoria" | "monto";

function shiftIsoDate(value: string, days: number) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, (day || 1) + days);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type ExpenseAccess = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
};

type Props = {
  report: ExpenseReport;
  access: ExpenseAccess;
  actor: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onEditReport: () => void;
  onDeleteReport: () => void;
};

export function ExpenseReportDetail({
  report,
  access,
  actor,
  onClose,
  onChanged,
  onEditReport,
  onDeleteReport,
}: Props) {
  const meta = expenseKindMeta(report.kind);
  const balance = reportBalance(report);
  const byCategory = categoryTotals(report.items);
  const editable = isReportEditable(report.status);
  const canCapture = editable && (access.canCreate || access.canEdit);

  const [itemForm, setItemForm] = useState<{ item: ExpenseItem | null } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [itemSort, setItemSort] = useState<ItemSort>("fecha");

  const orderedItems = useMemo(() => {
    const items = [...report.items];
    if (itemSort === "categoria") {
      items.sort(
        (a, b) =>
          categoryLabel(a.category).localeCompare(categoryLabel(b.category), "es") ||
          a.expenseDate.localeCompare(b.expenseDate)
      );
    } else if (itemSort === "monto") {
      items.sort((a, b) => b.total - a.total || a.expenseDate.localeCompare(b.expenseDate));
    } else {
      items.sort((a, b) => a.expenseDate.localeCompare(b.expenseDate) || a.concept.localeCompare(b.concept, "es"));
    }
    return items;
  }, [report.items, itemSort]);

  const groupedItems = useMemo(() => {
    if (itemSort !== "fecha") return null;
    const groups: { date: string; items: ExpenseItem[]; total: number }[] = [];
    for (const item of orderedItems) {
      const last = groups[groups.length - 1];
      if (!last || last.date !== item.expenseDate) groups.push({ date: item.expenseDate, items: [item], total: item.total });
      else {
        last.items.push(item);
        last.total += item.total;
      }
    }
    return groups;
  }, [orderedItems, itemSort]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy("");
    }
  }

  function changeStatus(status: ExpenseStatus, notes = "") {
    return run(status, async () => {
      await setExpenseReportStatus(report, status, actor, notes);
      setRejecting(false);
      setReviewNotes("");
    });
  }

  function changeItemDate(item: ExpenseItem, expenseDate: string) {
    if (!expenseDate || expenseDate === item.expenseDate) return;
    void run(`date-${item.id}`, () => updateExpenseItemDate(item, expenseDate));
  }

  function removeItem(item: ExpenseItem) {
    if (!confirm(`¿Eliminar el gasto "${item.concept || item.supplierName}" y sus comprobantes?`)) return;
    void run(`item-${item.id}`, () => deleteExpenseItem(item));
  }

  async function pdf(output: PdfOutput) {
    setBusy(`pdf-${output}`);
    try {
      await exportExpenseReportPdf(report, output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setBusy("");
    }
  }

  function renderItem(item: ExpenseItem) {
    const name = item.concept || item.supplierName || categoryLabel(item.category);
    const outside = item.expenseDate < report.startDate || item.expenseDate > report.endDate;
    const canShift = report.kind === "viaticos" && canCapture && access.canEdit;
    const shifting = busy === `date-${item.id}`;
    return (
      <li key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium">
            <CategoryDot color={categoryColor(item.category)} />
            <span className="truncate">{name}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {canShift ? (
              <span className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
                  aria-label={`Un día antes para ${name}`}
                  disabled={Boolean(busy)}
                  onClick={() => changeItemDate(item, shiftIsoDate(item.expenseDate, -1))}
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <input
                  type="date"
                  aria-label={`Fecha de ${name}`}
                  className="h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
                  value={item.expenseDate}
                  disabled={Boolean(busy)}
                  onChange={(event) => changeItemDate(item, event.target.value)}
                />
                <button
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
                  aria-label={`Un día después para ${name}`}
                  disabled={Boolean(busy)}
                  onClick={() => changeItemDate(item, shiftIsoDate(item.expenseDate, 1))}
                >
                  {shifting ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronRight className="size-3.5" />}
                </button>
              </span>
            ) : (
              <span>{formatDate(item.expenseDate)}</span>
            )}
            <span>
              {categoryLabel(item.category)}
              {item.taxType ? ` · ${item.taxType}` : ""}
              {item.supplierName && item.concept ? ` · ${item.supplierName}` : ""}
              {item.supplierRfc ? ` · ${item.supplierRfc}` : ""}
              {" · "}
              {paymentMethodLabel(item.paymentMethod)}
            </span>
            {report.kind === "viaticos" && outside ? (
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">Fuera del viaje</span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {item.pdfUrl ? (
              <ReceiptFileLink path={item.pdfPath} url={item.pdfUrl} invoiceNumber={item.invoiceNumber} />
            ) : null}
            {item.xmlUrl ? (
              <a
                href={item.xmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-[#00BFFF]/10 px-2 py-0.5 font-medium text-sky-700 hover:underline dark:text-sky-300"
                onClick={(event) =>
                  openStoredFileOnMobile(event, {
                    url: item.xmlUrl,
                    title: item.invoiceNumber ? `XML ${item.invoiceNumber}` : "XML del comprobante",
                    fileName: `${item.invoiceNumber || "cfdi"}.xml`,
                    mime: "application/xml",
                  })
                }
              >
                <FileCode2 className="size-3.5" />
                XML
              </a>
            ) : null}
            {item.invoiceNumber ? <span className="text-muted-foreground">Factura {item.invoiceNumber}</span> : null}
            {!itemHasInvoice(item) ? (
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300"><Ui>Sin factura</Ui></span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 font-semibold tabular-nums">{formatMoney(item.total)}</span>
          {canCapture && access.canEdit ? (
            <Button size="sm" variant="outline" aria-label={`Editar ${name}`} onClick={() => setItemForm({ item })} disabled={Boolean(busy)}>
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {canCapture && (access.canDelete || access.canEdit) ? (
            <Button size="sm" variant="outline" aria-label={`Eliminar ${name}`} onClick={() => removeItem(item)} disabled={Boolean(busy)}>
              {busy === `item-${item.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            </Button>
          ) : null}
        </div>
      </li>
    );
  }

  const period =
    report.startDate === report.endDate
      ? formatDate(report.startDate)
      : `${formatDate(report.startDate)} al ${formatDate(report.endDate)}`;

  const statusButtons: ReactNode[] = [];
  if (canCapture) {
    statusButtons.push(
      <Button
        key="send"
        size="sm"
        onClick={() => void changeStatus("por_revisar")}
        disabled={Boolean(busy) || report.items.length === 0}
      >
        {busy === "por_revisar" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Enviar a revisión
      </Button>
    );
  }
  if (report.status === "por_revisar" && access.canApprove) {
    statusButtons.push(
      <Button key="approve" size="sm" onClick={() => void changeStatus("aprobado", reviewNotes)} disabled={Boolean(busy)}>
        {busy === "aprobado" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
        Aprobar
      </Button>,
      <Button key="reject" size="sm" variant="outline" onClick={() => setRejecting((v) => !v)} disabled={Boolean(busy)}>
        <XCircle className="size-4" /> <Ui>Rechazar</Ui></Button>
    );
  }
  if (report.status === "por_revisar" && (access.canCreate || access.canEdit)) {
    statusButtons.push(
      <Button key="back" size="sm" variant="outline" onClick={() => void changeStatus("en_captura")} disabled={Boolean(busy)}>
        <RotateCcw className="size-4" />
        Regresar a captura
      </Button>
    );
  }
  if (report.status === "aprobado" && access.canApprove) {
    statusButtons.push(
      <Button key="close" size="sm" onClick={() => void changeStatus("cerrado")} disabled={Boolean(busy)}>
        <Lock className="size-4" />
        Cerrar (saldo liquidado)
      </Button>
    );
  }
  if ((report.status === "aprobado" || report.status === "cancelado" || report.status === "cerrado") && access.canApprove) {
    statusButtons.push(
      <Button key="reopen" size="sm" variant="outline" onClick={() => void changeStatus("en_captura")} disabled={Boolean(busy)}>
        <RotateCcw className="size-4" />
        Reabrir
      </Button>
    );
  }
  if (access.canDelete && report.status !== "cerrado" && report.status !== "cancelado") {
    statusButtons.push(
      <Button
        key="cancel"
        size="sm"
        variant="outline"
        onClick={() => {
          if (confirm("¿Cancelar este registro? Seguirá en el historial, pero no contará en los reportes.")) {
            void changeStatus("cancelado");
          }
        }}
        disabled={Boolean(busy)}
      >
        <XCircle className="size-4" />
        Cancelar registro
      </Button>
    );
  }

  return (
    <>
      <ModalShell
        title={`${report.folio} · ${reportTitle(report)}`}
        description={`${meta.label} · ${report.employeeName}${report.department ? ` · ${report.department}` : ""}`}
        className="max-w-5xl"
        headerAction={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {access.canExport ? (
              <>
                <Button size="sm" variant="outline" onClick={() => void pdf("print")} disabled={Boolean(busy)}>
                  {busy === "pdf-print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                  <span className="hidden sm:inline"><Ui>Imprimir</Ui></span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => void pdf("download")} disabled={Boolean(busy)}>
                  {busy === "pdf-download" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                  <span className="hidden sm:inline">PDF</span>
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="outline" onClick={onClose}><Ui>Cerrar</Ui></Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <StatusBadge status={report.status} />
            <span>
              <span className="text-muted-foreground">{meta.isTrip ? "Fechas: " : "Periodo: "}</span>
              {period}
              {meta.isTrip ? ` (${reportDays(report)} días)` : ""}
            </span>
            {report.clientName ? (
              <span>
                <span className="text-muted-foreground">Cliente: </span>
                {report.clientName}
              </span>
            ) : null}
            {report.purpose ? (
              <span>
                <span className="text-muted-foreground">{meta.isTrip ? "Objetivo: " : "Descripción: "}</span>
                {report.purpose}
              </span>
            ) : null}
            {editable && access.canEdit ? (
              <button type="button" className="inline-flex items-center gap-1 text-[#3B46A5] hover:underline" onClick={onEditReport}>
                <Pencil className="size-3.5" /> <Ui>Editar datos</Ui></button>
            ) : null}
          </div>

          {report.status === "rechazado" && report.reviewNotes ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Rechazado por {report.reviewedBy}: {report.reviewNotes}
            </p>
          ) : null}

          <div className={cn("grid gap-3", meta.advanceLabel ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3")}>
            <KpiCard label="Total de gastos" value={formatMoney(balance.spent)} hint={`${report.items.length} comprobantes`} />
            <KpiCard
              label="Con factura"
              value={formatMoney(balance.invoiced)}
              hint={balance.withoutInvoice > 0 ? `${formatMoney(balance.withoutInvoice)} sin factura` : "Todo facturado"}
              tone={balance.withoutInvoice > 0 ? "warning" : undefined}
            />
            {meta.advanceLabel ? (
              <>
                <KpiCard
                  label={meta.advanceLabel}
                  value={formatMoney(balance.advance)}
                  hint={`Pagado por la empresa: ${formatMoney(balance.companyPaid)}`}
                />
                <KpiCard
                  label={balanceLabel(balance.balance)}
                  value={formatMoney(Math.abs(balance.balance))}
                  tone={Math.abs(balance.balance) < 0.005 ? "success" : balance.balance > 0 ? "warning" : "danger"}
                />
              </>
            ) : (
              <KpiCard
                label="Pagado por colaborador"
                value={formatMoney(balance.employeePaid)}
                hint={balance.employeePaid > 0 ? "A reembolsar" : "Pagado por la empresa"}
              />
            )}
          </div>

          {report.kind === "viaticos" && report.items.length > 0 ? (
            <ExpenseTripChart items={report.items} startDate={report.startDate} endDate={report.endDate} />
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <section className="rounded-xl border border-border">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h4 className="font-semibold">Gastos</h4>
                  {report.kind === "viaticos" && canCapture ? (
                    <p className="text-xs text-muted-foreground">Cambia la fecha aquí para reacomodar el ticket.</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {report.items.length > 1 ? (
                    <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Ordenar gastos">
                      {(
                        [
                          ["fecha", "Fecha"],
                          ["categoria", "Tipo"],
                          ["monto", "Monto"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={itemSort === id}
                          className={cn(
                            "rounded-md px-2 py-1 font-medium",
                            itemSort === id ? "bg-[#3B46A5] text-white" : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setItemSort(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {canCapture && access.canCreate ? (
                    <Button size="sm" onClick={() => setItemForm({ item: null })}>
                      <Plus className="size-4" />
                      Agregar gasto
                    </Button>
                  ) : null}
                </div>
              </header>
              {report.items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Aún no hay gastos. {canCapture ? "Agrega la factura o, si no hay, una foto del ticket." : ""}
                </p>
              ) : groupedItems ? (
                <div>
                  {groupedItems.map((group) => {
                    const outside = group.date < report.startDate || group.date > report.endDate;
                    return (
                      <section key={group.date}>
                        <header className={cn("flex items-center justify-between gap-2 bg-muted/40 px-4 py-1.5 text-xs", outside && "text-amber-700 dark:text-amber-300")}>
                          <span className="font-medium">{formatDate(group.date)}{outside ? " · Fuera del viaje" : ""}</span>
                          <span className="tabular-nums">{formatMoney(group.total)} · {group.items.length}</span>
                        </header>
                        <ul className="divide-y divide-border">{group.items.map((item) => renderItem(item))}</ul>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <ul className="divide-y divide-border">{orderedItems.map((item) => renderItem(item))}</ul>
              )}
            </section>

            <div className="space-y-5">
              <section className="rounded-xl border border-border p-4">
                <h4 className="mb-3 font-semibold">Por categoría</h4>
                <CategoryBars rows={byCategory} />
              </section>

              {statusButtons.length || (access.canDelete && (report.status === "en_captura" || report.status === "cancelado")) ? (
                <section className="space-y-3 rounded-xl border border-border p-4">
                  <h4 className="font-semibold"><Ui>Acciones</Ui></h4>
                  {report.status === "por_revisar" && access.canApprove ? (
                    <textarea
                      className={`${inputClass} h-16 py-2`}
                      placeholder={rejecting ? "Motivo del rechazo (obligatorio)" : "Comentarios de revisión (opcional)"}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  ) : null}
                  {rejecting ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-destructive/40 text-destructive"
                      onClick={() => void changeStatus("rechazado", reviewNotes)}
                      disabled={Boolean(busy)}
                    >
                      {busy === "rechazado" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                      Confirmar rechazo
                    </Button>
                  ) : null}
                  <div className="flex flex-wrap gap-2">{statusButtons}</div>
                  {canCapture && report.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Agrega al menos un gasto para enviarlo a revisión.</p>
                  ) : null}
                  {access.canDelete && (report.status === "en_captura" || report.status === "cancelado") ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      onClick={onDeleteReport}
                      disabled={Boolean(busy)}
                    >
                      <Trash2 className="size-3.5" />
                      Eliminar definitivamente
                    </button>
                  ) : null}
                </section>
              ) : null}

              <section className="rounded-xl border border-border p-4">
                <h4 className="mb-3 font-semibold">Historial</h4>
                {report.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin movimientos.</p>
                ) : (
                  <ol className="space-y-2.5 text-sm">
                    {[...report.events].reverse().map((event) => (
                      <li key={event.id} className="border-l-2 border-[#3B46A5]/30 pl-3">
                        <p>{event.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.createdBy || "Sistema"} · {new Date(event.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </ModalShell>

      {itemForm ? (
        <ExpenseItemForm
          report={report}
          item={itemForm.item}
          actor={actor}
          onClose={() => setItemForm(null)}
          onSaved={async () => {
            setItemForm(null);
            await onChanged();
          }}
        />
      ) : null}
    </>
  );
}
