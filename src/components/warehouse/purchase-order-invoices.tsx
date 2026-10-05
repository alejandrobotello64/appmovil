"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { FileCode2, FileText, Receipt, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { Notice, fieldClass, formatDate, primaryButtonClass, textareaClass } from "@/components/tools/tools-shared";
import {
  addPurchaseOrderInvoice,
  deletePurchaseOrderInvoice,
  parseCfdiXml,
  type PurchaseOrderInvoice,
} from "@/lib/warehouse/order-invoices";
import { purchaseOrderTotal, type PurchaseOrder } from "@/lib/warehouse/orders";

export function formatMoney(value: number, currency = "MXN") {
  try {
    return value.toLocaleString("es-MX", { style: "currency", currency: currency || "MXN" });
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Resumen corto de facturación de una OC para listados. */
export function invoiceSummary(order: PurchaseOrder) {
  if (!order.invoices.length) return "Sin factura";
  const invoiced = order.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const count = order.invoices.length;
  return `${count} factura${count === 1 ? "" : "s"} · ${formatMoney(invoiced, order.invoices[0]?.currency)}`;
}

const EMPTY_FORM = {
  invoiceNumber: "",
  cfdiUuid: "",
  issuerRfc: "",
  issuerName: "",
  invoiceDate: "",
  subtotal: "",
  total: "",
  currency: "MXN",
  notes: "",
};

export function PurchaseOrderInvoicesModal({
  order,
  canAdd,
  canDelete,
  supplierRfc,
  actor,
  onClose,
  onChanged,
}: {
  order: PurchaseOrder;
  canAdd: boolean;
  canDelete: boolean;
  supplierRfc?: string;
  actor: string;
  onClose: () => void;
  onChanged: (invoices: PurchaseOrderInvoice[]) => void;
}) {
  const [invoices, setInvoices] = useState(order.invoices);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const orderTotal = purchaseOrderTotal(order);
  const invoiced = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const difference = orderTotal - invoiced;
  const rfcMismatch =
    Boolean(supplierRfc && form.issuerRfc) &&
    supplierRfc!.trim().toUpperCase() !== form.issuerRfc.trim().toUpperCase();

  function update(patch: Partial<typeof EMPTY_FORM>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function publish(next: PurchaseOrderInvoice[]) {
    setInvoices(next);
    onChanged(next);
  }

  async function onXmlChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setXmlFile(file);
    setError("");
    if (!file) return;
    try {
      const data = parseCfdiXml(await file.text());
      setForm((current) => ({
        ...current,
        invoiceNumber: data.invoiceNumber || current.invoiceNumber,
        cfdiUuid: data.cfdiUuid || current.cfdiUuid,
        issuerRfc: data.issuerRfc || current.issuerRfc,
        issuerName: data.issuerName || current.issuerName,
        invoiceDate: data.invoiceDate || current.invoiceDate,
        subtotal: data.subtotal ? String(data.subtotal) : current.subtotal,
        total: data.total ? String(data.total) : current.total,
        currency: data.currency || current.currency,
      }));
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : "No se pudo leer el XML."} Captura los datos a mano.`
      );
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await addPurchaseOrderInvoice({
        orderId: order.id,
        invoiceNumber: form.invoiceNumber,
        cfdiUuid: form.cfdiUuid,
        issuerRfc: form.issuerRfc,
        issuerName: form.issuerName,
        invoiceDate: form.invoiceDate,
        subtotal: Number(form.subtotal) || 0,
        total: Number(form.total) || 0,
        currency: form.currency,
        notes: form.notes,
        uploadedBy: actor,
        pdfFile,
        xmlFile,
      });
      publish([...invoices, created]);
      setForm(EMPTY_FORM);
      setPdfFile(null);
      setXmlFile(null);
      setFileKey((key) => key + 1);
      setMessage(`Factura ${created.invoiceNumber || created.cfdiUuid} ligada a ${order.orderNumber}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la factura.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(invoice: PurchaseOrderInvoice) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await deletePurchaseOrderInvoice(invoice);
      publish(invoices.filter((item) => item.id !== invoice.id));
      setConfirmingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la factura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={`Facturas · ${order.orderNumber}`}
      description={`${order.supplierName} · Total OC ${formatMoney(orderTotal)}`}
      className="max-w-3xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <Notice tone="error">{error}</Notice>
        <Notice tone="success">{message}</Notice>

        <dl className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Total de la OC</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(orderTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Facturado</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(invoiced)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Diferencia</dt>
            <dd
              className={
                Math.abs(difference) < 0.01
                  ? "font-semibold text-emerald-700 tabular-nums dark:text-emerald-300"
                  : "font-semibold text-amber-700 tabular-nums dark:text-amber-300"
              }
            >
              {formatMoney(difference)}
            </dd>
          </div>
        </dl>

        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Esta orden de compra aún no tiene facturas ligadas.
          </p>
        ) : (
          <ul className="space-y-2">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="rounded-xl border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Receipt className="size-4 text-[#3B46A5]" />
                      {invoice.invoiceNumber || "Sin folio"} · {formatMoney(invoice.total, invoice.currency)}
                    </p>
                    {invoice.cfdiUuid ? (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">UUID {invoice.cfdiUuid}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {[
                        invoice.invoiceDate ? formatDate(invoice.invoiceDate) : "",
                        invoice.issuerName || invoice.issuerRfc,
                        invoice.uploadedBy && `Registró ${invoice.uploadedBy}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {invoice.notes ? <p className="mt-1 text-xs">{invoice.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {invoice.pdfUrl ? (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-muted"
                      >
                        <FileText className="size-3.5" /> PDF
                      </a>
                    ) : null}
                    {invoice.xmlUrl ? (
                      <a
                        href={invoice.xmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-muted"
                      >
                        <FileCode2 className="size-3.5" /> XML
                      </a>
                    ) : null}
                    {canDelete ? (
                      confirmingId === invoice.id ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void onDelete(invoice)}
                          >
                            Confirmar
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                            No
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmingId(invoice.id)}
                          aria-label="Quitar factura"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {canAdd && order.status !== "cancelado" ? (
          <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-[#3B46A5]/30 bg-[#3B46A5]/5 p-3">
            <h4 className="text-sm font-semibold">Ligar factura del proveedor</h4>
            <p className="text-xs text-muted-foreground">
              Sube el XML del CFDI y se llenan folio, UUID, fecha y montos. Si solo tienes el PDF, captura los datos a mano.
            </p>
            <div key={fileKey} className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">XML (CFDI)</span>
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={(event) => void onXmlChange(event)}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">PDF</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Serie y folio</span>
                <input className={fieldClass} value={form.invoiceNumber} onChange={(e) => update({ invoiceNumber: e.target.value })} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">UUID (folio fiscal)</span>
                <input
                  className={`${fieldClass} font-mono uppercase`}
                  value={form.cfdiUuid}
                  onChange={(e) => update({ cfdiUuid: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Fecha de emisión</span>
                <input type="date" className={fieldClass} value={form.invoiceDate} onChange={(e) => update({ invoiceDate: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">RFC emisor</span>
                <input
                  className={`${fieldClass} uppercase`}
                  value={form.issuerRfc}
                  onChange={(e) => update({ issuerRfc: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Emisor</span>
                <input className={fieldClass} value={form.issuerName} onChange={(e) => update({ issuerName: e.target.value })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Subtotal</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={fieldClass}
                  value={form.subtotal}
                  onChange={(e) => update({ subtotal: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Total</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={fieldClass}
                  value={form.total}
                  onChange={(e) => update({ total: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Moneda</span>
                <input
                  className={`${fieldClass} uppercase`}
                  value={form.currency}
                  maxLength={3}
                  onChange={(e) => update({ currency: e.target.value })}
                />
              </label>
            </div>
            {rfcMismatch ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                El RFC del emisor ({form.issuerRfc.toUpperCase()}) no coincide con el del proveedor en el catálogo (
                {supplierRfc!.toUpperCase()}). Verifica que sea la factura correcta.
              </p>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Notas</span>
              <textarea className={textareaClass} value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
            </label>
            <div className="flex justify-end">
              <Button type="submit" className={primaryButtonClass} disabled={busy}>
                <Receipt className="size-4" /> {busy ? "Guardando…" : "Ligar factura"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </ModalShell>
  );
}
