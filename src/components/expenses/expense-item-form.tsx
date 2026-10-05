"use client";

import { useState, type FormEvent } from "react";
import { FileCode2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { addExpenseItem, updateExpenseItem } from "@/lib/expenses/storage";
import {
  PAYMENT_METHODS,
  categoriesForKind,
  categoryLabel,
  formatMoney,
  todayIso,
  type ExpenseCategoryId,
  type ExpenseItem,
  type ExpenseItemInput,
  type ExpenseReport,
  type PaymentMethod,
} from "@/lib/expenses/types";
import { parseCfdiXml } from "@/lib/warehouse/order-invoices";
import { Field, inputClass } from "./expense-ui";

const round = (value: number) => Math.round(value * 100) / 100;

function defaultPayment(report: ExpenseReport): PaymentMethod {
  if (report.kind === "corriente") return "pago_empresa";
  return report.advanceAmount > 0 ? "efectivo" : "personal";
}

function emptyInput(report: ExpenseReport): ExpenseItemInput {
  const today = todayIso();
  const date = today < report.startDate ? report.startDate : today > report.endDate ? report.endDate : today;
  const categories = categoriesForKind(report.kind);
  return {
    expenseDate: date,
    category: categories[0]?.id ?? "otros",
    concept: "",
    supplierName: "",
    supplierRfc: "",
    invoiceNumber: "",
    cfdiUuid: "",
    subtotal: 0,
    tax: 0,
    total: 0,
    paymentMethod: defaultPayment(report),
    notes: "",
    pdfFile: null,
    xmlFile: null,
  };
}

function inputFromItem(item: ExpenseItem): ExpenseItemInput {
  return {
    expenseDate: item.expenseDate,
    category: item.category,
    concept: item.concept,
    supplierName: item.supplierName,
    supplierRfc: item.supplierRfc,
    invoiceNumber: item.invoiceNumber,
    cfdiUuid: item.cfdiUuid,
    subtotal: item.subtotal,
    tax: item.tax,
    total: item.total,
    paymentMethod: item.paymentMethod,
    notes: item.notes,
    pdfFile: null,
    xmlFile: null,
  };
}

type Props = {
  report: ExpenseReport;
  item?: ExpenseItem | null;
  actor: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ExpenseItemForm({ report, item, actor, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ExpenseItemInput>(() => (item ? inputFromItem(item) : emptyInput(report)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [xmlNotice, setXmlNotice] = useState("");

  const categories = categoriesForKind(report.kind);
  const categoryOptions = categories.some((c) => c.id === form.category)
    ? categories
    : [...categories, { id: form.category, label: categoryLabel(form.category) }];

  function patch(values: Partial<ExpenseItemInput>) {
    setForm((prev) => ({ ...prev, ...values }));
  }

  function setAmount(field: "subtotal" | "tax", value: number) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      next.total = round(next.subtotal + next.tax);
      return next;
    });
  }

  async function chooseXml(file: File | null) {
    patch({ xmlFile: file });
    setXmlNotice("");
    if (!file) return;
    try {
      const cfdi = parseCfdiXml(await file.text());
      const tax = cfdi.total > cfdi.subtotal ? round(cfdi.total - cfdi.subtotal) : 0;
      setForm((prev) => ({
        ...prev,
        xmlFile: file,
        supplierName: cfdi.issuerName || prev.supplierName,
        supplierRfc: cfdi.issuerRfc || prev.supplierRfc,
        invoiceNumber: cfdi.invoiceNumber || prev.invoiceNumber,
        cfdiUuid: cfdi.cfdiUuid || prev.cfdiUuid,
        expenseDate: cfdi.invoiceDate || prev.expenseDate,
        subtotal: cfdi.subtotal || prev.subtotal,
        tax: cfdi.total ? tax : prev.tax,
        total: cfdi.total || prev.total,
      }));
      setXmlNotice(
        `Datos tomados del CFDI${cfdi.currency !== "MXN" ? ` (moneda ${cfdi.currency})` : ""}: ${cfdi.issuerName || cfdi.issuerRfc} · ${formatMoney(cfdi.total)}`
      );
    } catch (err) {
      setXmlNotice(err instanceof Error ? err.message : "No se pudo leer el XML.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (item) await updateExpenseItem(item, form);
      else await addExpenseItem(report.id, form, actor);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el gasto.");
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={item ? "Editar gasto" : "Agregar gasto"}
      description={`${report.folio} · Sube la factura en PDF (o foto del ticket) y, si la tienes, el XML para llenar los datos automáticamente.`}
      headerAction={
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3 sm:grid-cols-2">
          <Field
            label="Factura PDF o foto del ticket"
            hint={item?.pdfUrl && !form.pdfFile ? "Ya tiene archivo; elige otro para reemplazarlo." : undefined}
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="file"
                accept="application/pdf,image/*"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#3B46A5]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#3B46A5]"
                onChange={(e) => patch({ pdfFile: e.target.files?.[0] ?? null })}
              />
            </span>
          </Field>
          <Field
            label="XML del CFDI (opcional)"
            hint={item?.xmlUrl && !form.xmlFile ? "Ya tiene XML; elige otro para reemplazarlo." : undefined}
          >
            <span className="flex items-center gap-2">
              <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#3B46A5]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#3B46A5]"
                onChange={(e) => void chooseXml(e.target.files?.[0] ?? null)}
              />
            </span>
          </Field>
          {xmlNotice ? <p className="text-xs text-muted-foreground sm:col-span-2">{xmlNotice}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fecha *">
            <input
              type="date"
              className={inputClass}
              value={form.expenseDate}
              onChange={(e) => patch({ expenseDate: e.target.value })}
            />
          </Field>
          <Field label="Categoría *">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => patch({ category: e.target.value as ExpenseCategoryId })}
            >
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Concepto" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.concept}
              onChange={(e) => patch({ concept: e.target.value })}
              placeholder="Ej. Hotel 2 noches, comida con cliente, recibo de luz…"
            />
          </Field>
          <Field label="Proveedor">
            <input
              className={inputClass}
              value={form.supplierName}
              onChange={(e) => patch({ supplierName: e.target.value })}
            />
          </Field>
          <Field label="RFC del proveedor">
            <input
              className={`${inputClass} uppercase`}
              value={form.supplierRfc}
              onChange={(e) => patch({ supplierRfc: e.target.value })}
              maxLength={13}
            />
          </Field>
          <Field label="Folio de factura" hint="Con folio, UUID o XML cuenta como facturado; si no, es ticket.">

            <input
              className={inputClass}
              value={form.invoiceNumber}
              onChange={(e) => patch({ invoiceNumber: e.target.value })}
            />
          </Field>
          <Field label="UUID (folio fiscal)">
            <input
              className={`${inputClass} uppercase`}
              value={form.cfdiUuid}
              onChange={(e) => patch({ cfdiUuid: e.target.value })}
            />
          </Field>
          <Field label="Subtotal">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.subtotal || ""}
              onChange={(e) => setAmount("subtotal", Number(e.target.value) || 0)}
              placeholder="0.00"
            />
          </Field>
          <Field label="IVA / impuestos">
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.tax || ""}
              onChange={(e) => setAmount("tax", Number(e.target.value) || 0)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Total *" hint="Se calcula con subtotal + IVA; puedes ajustarlo (propinas, descuentos).">
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${inputClass} font-semibold`}
              value={form.total || ""}
              onChange={(e) => patch({ total: Number(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </Field>
          <Field label="Forma de pago">
            <select
              className={inputClass}
              value={form.paymentMethod}
              onChange={(e) => patch({ paymentMethod: e.target.value as PaymentMethod })}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notas" className="sm:col-span-2">
            <input
              className={inputClass}
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
            {item ? "Guardar cambios" : "Agregar gasto"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
