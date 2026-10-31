"use client";

import { useRef, useState, type FormEvent } from "react";
import { FileCode2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { addExpenseItem, updateExpenseItem } from "@/lib/expenses/storage";
import {
  PAYMENT_METHODS,
  categoriesForKind,
  categoryLabel,
  todayIso,
  type ExpenseCategoryId,
  type ExpenseItem,
  type ExpenseItemInput,
  type ExpenseReport,
  type PaymentMethod,
} from "@/lib/expenses/types";
import { recognizeReceiptUpload } from "@/lib/expenses/recognize-receipt-file";
import type { ReceiptFill } from "@/lib/expenses/receipt-recognition";
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
    taxType: "",
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
    taxType: item.taxType,
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
  const [fileNotice, setFileNotice] = useState("");
  const [readingFile, setReadingFile] = useState(false);
  const readSeq = useRef(0);

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

  function acceptedCategory(fill: ReceiptFill): ExpenseCategoryId | null {
    if (!fill.category) return null;
    return categories.some((category) => category.id === fill.category) ? fill.category : null;
  }

  function applyFill(prev: ExpenseItemInput, fill: ReceiptFill, filePatch: Partial<ExpenseItemInput>) {
    const category = acceptedCategory(fill);
    const next: ExpenseItemInput = { ...prev, ...filePatch };
    if (fill.concept) next.concept = fill.concept;
    if (fill.supplierName) next.supplierName = fill.supplierName;
    if (fill.supplierRfc) next.supplierRfc = fill.supplierRfc;
    if (fill.invoiceNumber) next.invoiceNumber = fill.invoiceNumber;
    if (fill.cfdiUuid) next.cfdiUuid = fill.cfdiUuid;
    if (fill.expenseDate) next.expenseDate = fill.expenseDate;
    if (fill.taxType) next.taxType = fill.taxType;
    if (category) next.category = category;
    if (fill.subtotal != null) next.subtotal = fill.subtotal;
    if (fill.tax != null) next.tax = fill.tax;
    if (fill.total != null) next.total = fill.total;
    else if (fill.subtotal != null || fill.tax != null) {
      next.total = round((fill.subtotal ?? prev.subtotal) + (fill.tax ?? prev.tax));
    }
    return { next, category };
  }

  function fillNotice(fill: ReceiptFill, category: ExpenseCategoryId | null) {
    const parts = [
      fill.supplierName,
      fill.invoiceNumber ? `folio ${fill.invoiceNumber}` : "",
      fill.taxType,
      category ? categoryLabel(category) : "",
    ].filter(Boolean);
    const summary = parts.length
      ? `Se llenó el gasto: ${parts.join(" · ")}.`
      : "Se leyó el archivo, pero no trajo datos para llenar.";
    if (fill.category && !category) {
      return `${summary} ${categoryLabel(fill.category)} no aplica en este registro.`;
    }
    return summary;
  }

  async function chooseReceipt(kind: "pdf" | "xml", file: File | null) {
    const seq = ++readSeq.current;
    setForm((prev) => ({ ...prev, ...(kind === "pdf" ? { pdfFile: file } : { xmlFile: file }) }));
    setFileNotice("");
    if (!file) return;
    if (kind === "pdf" && file.type.startsWith("image/")) {
      setFileNotice("La foto se guarda con el gasto. Para llenar los datos sube el XML o un PDF con texto.");
      return;
    }
    setReadingFile(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await recognizeReceiptUpload(body);
      if (seq !== readSeq.current) return;
      if ("error" in result) {
        setFileNotice(result.error);
        return;
      }
      const category = acceptedCategory(result.fill);
      setForm((prev) => applyFill(prev, result.fill, kind === "pdf" ? { pdfFile: file } : { xmlFile: file }).next);
      setFileNotice(fillNotice(result.fill, category));
    } catch (err) {
      if (seq !== readSeq.current) return;
      setFileNotice(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    } finally {
      if (seq === readSeq.current) setReadingFile(false);
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
      description={`${report.folio} · El XML o un PDF con texto llena el gasto, incluidos IVA, IEPS y el impuesto de hospedaje.`}
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
            hint={
              item?.pdfUrl && !form.pdfFile
                ? "Ya tiene archivo; elige otro para reemplazarlo."
                : "Un PDF con texto llena el gasto. Una foto se guarda, pero no se lee."
            }
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="file"
                accept="application/pdf,image/*"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#3B46A5]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#3B46A5]"
                onChange={(e) => void chooseReceipt("pdf", e.target.files?.[0] ?? null)}
              />
            </span>
          </Field>
          <Field
            label="XML del CFDI (opcional)"
            hint={
              item?.xmlUrl && !form.xmlFile
                ? "Ya tiene XML; elige otro para reemplazarlo y volver a llenar los datos."
                : "Llena proveedor, folio, importes, categoría e impuestos."
            }
          >
            <span className="flex items-center gap-2">
              <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#3B46A5]/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#3B46A5]"
                onChange={(e) => void chooseReceipt("xml", e.target.files?.[0] ?? null)}
              />
            </span>
          </Field>
          {readingFile ? <p className="text-xs text-muted-foreground sm:col-span-2">Leyendo el archivo…</p> : null}
          {fileNotice ? <p className="text-xs text-muted-foreground sm:col-span-2">{fileNotice}</p> : null}
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
          <Field label="Tipo de impuesto" hint="IVA, IEPS, hospedaje u otros. Puedes corregirlo.">
            <input
              className={inputClass}
              value={form.taxType}
              onChange={(e) => patch({ taxType: e.target.value })}
              placeholder="IVA 16%, IEPS, Impuesto sobre hospedaje 3%"
            />
          </Field>
          <Field label="Impuestos" hint="Suma IVA, IEPS y hospedaje. Las retenciones se anotan en el tipo y no se suman aquí.">
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
          <Field label="Total *" hint="Con retenciones se respeta el total del comprobante. Si no, es subtotal más impuestos.">
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
