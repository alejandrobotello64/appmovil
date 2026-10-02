"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  FileDown,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { PurchaseStatusBadge, formatQty } from "@/components/purchasing/purchasing-shared";
import { Notice, fieldClass, primaryButtonClass, textareaClass } from "@/components/tools/tools-shared";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { getProductAvailableQty } from "@/lib/holds/storage";
import { createPurchaseRequest, getPurchaseRequests } from "@/lib/purchasing/storage";
import type { PurchaseRequest } from "@/lib/purchasing/types";
import { quoteStatusLabel, type Quote } from "@/lib/quotes/types";
import {
  cancelServiceOrderRequisition,
  createQuoteRequisition,
  getServiceOrderRequisitions,
} from "@/lib/service-orders/requisition-storage";
import {
  requisitionLinePending,
  requisitionLineStatusLabel,
  requisitionProgress,
  requisitionStatusLabel,
  type RequisitionPriority,
  type RequisitionStatus,
  type ServiceOrderRequisition,
} from "@/lib/service-orders/requisitions";
import { cn } from "@/lib/utils";

const CLOSED_QUOTE_STATUSES = ["rechazada", "cancelada", "vencida"];

export function requisitionStatusTone(status: RequisitionStatus) {
  switch (status) {
    case "solicitada":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "parcial":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "surtida":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-MX");
}

/**
 * Las partidas de la cotización se reescriben al editarla, así que se emparejan por producto
 * o, si están fuera de catálogo, por descripción.
 */
function matchKey(productId: string | null, description: string) {
  return productId ?? `libre:${description.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** Unidades pedidas y surtidas por partida, sin contar solicitudes o líneas canceladas. */
function requestedByKey(requisitions: ServiceOrderRequisition[]) {
  const requested = new Map<string, number>();
  const fulfilled = new Map<string, number>();
  for (const req of requisitions) {
    if (req.status === "cancelada") continue;
    for (const line of req.lines) {
      if (line.lineStatus === "cancelado") continue;
      const key = matchKey(line.productId, line.description);
      requested.set(key, (requested.get(key) ?? 0) + line.quantityRequested);
      fulfilled.set(key, (fulfilled.get(key) ?? 0) + line.quantityFulfilled);
    }
  }
  return { requested, fulfilled };
}

type DraftLine = {
  quoteLineId: string;
  productId: string | null;
  sku: string;
  description: string;
  unit: string;
  quoted: number;
  remaining: number;
  include: boolean;
  quantity: string;
};

function buildDraft(quote: Quote, requisitions: ServiceOrderRequisition[]): DraftLine[] {
  const { requested } = requestedByKey(requisitions);
  const left = new Map(requested);
  return quote.lines
    .filter((line) => line.productId || line.description.trim())
    .map((line) => {
      const description = line.description || line.productName;
      const key = matchKey(line.productId, description);
      const covered = Math.min(line.quantity, left.get(key) ?? 0);
      left.set(key, (left.get(key) ?? 0) - covered);
      const remaining = Math.max(0, line.quantity - covered);
      return {
        quoteLineId: line.id,
        productId: line.productId,
        sku: line.productSku,
        description,
        unit: line.unit || "pza",
        quoted: line.quantity,
        remaining,
        include: remaining > 0,
        quantity: formatQty(remaining),
      };
    });
}

function OffCatalogTag() {
  return (
    <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
      Fuera de catálogo
    </span>
  );
}

type LoadedState = {
  key: string;
  quoteId: string;
  requisitions: ServiceOrderRequisition[];
  purchases: PurchaseRequest[];
  error: string;
};

async function loadQuoteFulfillment(quoteId: string) {
  const requisitions = await getServiceOrderRequisitions({ quoteId });
  const purchases = (
    await Promise.all(
      requisitions.map((req) =>
        getPurchaseRequests({ requisitionId: req.id }).catch(() => [] as PurchaseRequest[])
      )
    )
  ).flat();
  return { requisitions, purchases };
}

export function QuoteFulfillmentSection({
  quote,
  canWrite,
  onChanged,
}: {
  quote: Quote;
  canWrite: boolean;
  /** Se llama tras crear o cancelar para refrescar la bitácora de la cotización. */
  onChanged?: () => void;
}) {
  const { session } = useSessionAccess();
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadedState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const key = `${quote.id}:${reloadKey}`;
  useEffect(() => {
    let active = true;
    loadQuoteFulfillment(quote.id)
      .then((result) => {
        if (active) setState({ key, quoteId: quote.id, ...result, error: "" });
      })
      .catch((err) => {
        if (active)
          setState({
            key,
            quoteId: quote.id,
            requisitions: [],
            purchases: [],
            error: err instanceof Error ? err.message : "No se pudo cargar el surtimiento.",
          });
      });
    return () => {
      active = false;
    };
  }, [quote.id, key]);

  const data = state?.quoteId === quote.id ? state : null;
  const loading = state?.key !== key;
  const requisitions = useMemo(() => data?.requisitions ?? [], [data]);
  const purchases = data?.purchases ?? [];

  const summary = useMemo(() => {
    const { requested, fulfilled } = requestedByKey(requisitions);
    const requestable = quote.lines.filter((line) => line.productId || line.description.trim());
    const quoted = new Map<string, number>();
    for (const line of requestable) {
      const key = matchKey(line.productId, line.description || line.productName);
      quoted.set(key, (quoted.get(key) ?? 0) + line.quantity);
    }
    let quotedTotal = 0;
    let requestedTotal = 0;
    let fulfilledTotal = 0;
    for (const [key, qty] of quoted) {
      quotedTotal += qty;
      requestedTotal += Math.min(qty, requested.get(key) ?? 0);
      fulfilledTotal += Math.min(qty, fulfilled.get(key) ?? 0);
    }
    return {
      quotedTotal,
      requestedTotal,
      fulfilledTotal,
      pendingToRequest: Math.max(0, quotedTotal - requestedTotal),
      percent: quotedTotal > 0 ? Math.round((fulfilledTotal / quotedTotal) * 100) : 0,
      requestableLines: requestable.length,
    };
  }, [quote.lines, requisitions]);

  const closed = CLOSED_QUOTE_STATUSES.includes(quote.status);
  const canRequest = canWrite && !closed && summary.requestableLines > 0;

  function reload(text = "") {
    setMessage(text);
    setReloadKey((value) => value + 1);
  }

  async function onPdf(requisition: ServiceOrderRequisition) {
    setError("");
    try {
      const { downloadRequisitionPdf } = await import("@/lib/service-orders/requisition-pdf");
      await downloadRequisitionPdf(requisition, {
        printedBy: session ? { username: session.username, fullName: session.fullName } : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    }
  }

  async function onCancel(requisition: ServiceOrderRequisition) {
    if (!window.confirm(`¿Cancelar la solicitud de surtimiento ${requisition.folio}?`)) return;
    setBusyId(requisition.id);
    setError("");
    try {
      await cancelServiceOrderRequisition(requisition.id, session?.username ?? "");
      reload(`Solicitud ${requisition.folio} cancelada.`);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2 font-semibold">
            <Truck className="size-4 text-[#3B46A5]" /> Surtimiento
          </h4>
          <p className="text-xs text-muted-foreground">
            Material pedido a almacén para entregar esta venta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Actualizar surtimiento"
            onClick={() => reload()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
          {canRequest ? (
            <Button
              type="button"
              className={primaryButtonClass}
              disabled={loading}
              onClick={() => {
                setError("");
                setMessage("");
                setDialogOpen(true);
              }}
            >
              <PackageCheck className="size-4" /> Solicitar surtimiento
            </Button>
          ) : null}
        </div>
      </div>

      <Notice tone="error">{error || data?.error}</Notice>
      <Notice tone="success">{message}</Notice>

      {closed ? (
        <p className="text-xs text-muted-foreground">
          La cotización está {quoteStatusLabel(quote.status).toLowerCase()}; ya no se pueden pedir surtimientos nuevos.
        </p>
      ) : summary.requestableLines === 0 ? (
        <p className="text-xs text-muted-foreground">La cotización no tiene partidas que surtir.</p>
      ) : null}

      {summary.quotedTotal > 0 ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Cotizado {formatQty(summary.quotedTotal)} · Solicitado {formatQty(summary.requestedTotal)} · Surtido{" "}
              {formatQty(summary.fulfilledTotal)}
            </span>
            <span className="font-medium text-foreground">{summary.percent}% entregado</span>
          </div>
          <ProgressBar percent={summary.percent} />
          {summary.pendingToRequest > 0 && requisitions.length > 0 && !closed ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Faltan {formatQty(summary.pendingToRequest)} unidad(es) por pedir a almacén.
            </p>
          ) : null}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Cargando surtimiento…</p>
      ) : requisitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay solicitudes de surtimiento.</p>
      ) : (
        <ul className="space-y-2">
          {requisitions.map((req) => (
            <RequisitionCard
              key={req.id}
              requisition={req}
              purchases={purchases.filter((purchase) => purchase.requisitionId === req.id)}
              canCancel={canWrite && req.status === "solicitada"}
              busy={busyId === req.id}
              onPdf={() => void onPdf(req)}
              onCancel={() => void onCancel(req)}
            />
          ))}
        </ul>
      )}

      {dialogOpen ? (
        <QuoteFulfillmentDialog
          quote={quote}
          requisitions={requisitions}
          requester={session ? { username: session.username, fullName: session.fullName } : null}
          onClose={() => setDialogOpen(false)}
          onCreated={({ requisition, purchase, purchaseError }) => {
            setDialogOpen(false);
            reload(
              `Solicitud ${requisition.folio} enviada a almacén${
                purchase ? ` y solicitud de compra ${purchase.folio} enviada a compras` : ""
              }. Aquí verás su avance.`
            );
            if (purchaseError) {
              setError(
                `La solicitud de surtimiento se creó, pero la compra no: ${purchaseError} Almacén puede pedirla desde su bandeja.`
              );
            }
            onChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          percent >= 100 ? "bg-emerald-500" : "bg-[linear-gradient(90deg,#00BFFF,#3B46A5)]"
        )}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

function RequisitionCard({
  requisition,
  purchases,
  canCancel,
  busy,
  onPdf,
  onCancel,
}: {
  requisition: ServiceOrderRequisition;
  purchases: PurchaseRequest[];
  canCancel: boolean;
  busy: boolean;
  onPdf: () => void;
  onCancel: () => void;
}) {
  const progress = requisitionProgress(requisition);
  return (
    <li className="space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{requisition.folio}</span>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                requisitionStatusTone(requisition.status)
              )}
            >
              {requisitionStatusLabel(requisition.status)}
            </span>
            {requisition.priority === "urgente" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3" /> Urgente
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pidió {requisition.requestedBy || "—"} ·{" "}
            {requisition.requestedAt ? new Date(requisition.requestedAt).toLocaleString("es-MX") : "—"}
            {requisition.fulfilledBy ? ` · Surtió ${requisition.fulfilledBy}` : ""}
          </p>
          {requisition.neededBy ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3" /> Requerido para {formatDate(requisition.neededBy)}
            </p>
          ) : null}
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onPdf}>
            <FileDown className="size-3.5" /> PDF
          </Button>
          {canCancel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={busy}
              onClick={onCancel}
            >
              <XCircle className="size-3.5" /> Cancelar
            </Button>
          ) : null}
        </div>
      </div>

      {requisition.status !== "cancelada" ? (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatQty(progress.fulfilled)} de {formatQty(progress.requested)} surtido
            </span>
            <span>{progress.percent}%</span>
          </div>
          <ProgressBar percent={progress.percent} />
        </div>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {requisition.lines.map((line) => {
          const pending = requisitionLinePending(line);
          return (
            <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{line.description}</span>
                {line.productSku ? <span className="text-muted-foreground"> · {line.productSku}</span> : null}
                {!line.productId ? (
                  <span className="ml-1.5">
                    <OffCatalogTag />
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                Pedido {formatQty(line.quantityRequested)} {line.unit} · Surtido{" "}
                <span className={line.quantityFulfilled > 0 ? "text-emerald-700 dark:text-emerald-300" : ""}>
                  {formatQty(line.quantityFulfilled)}
                </span>{" "}
                · Pend.{" "}
                <span className={pending > 0 ? "font-medium text-amber-700 dark:text-amber-300" : ""}>
                  {formatQty(pending)}
                </span>
              </span>
              <span className="w-full text-[11px] text-muted-foreground sm:w-auto">
                {requisitionLineStatusLabel(line.lineStatus)}
              </span>
            </li>
          );
        })}
      </ul>

      {purchases.length ? (
        <div className="space-y-1 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2 text-xs">
          <p className="flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300">
            <ShoppingCart className="size-3" /> Compras ligadas
          </p>
          {purchases.map((purchase) => (
            <div key={purchase.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{purchase.folio}</span>
              <PurchaseStatusBadge status={purchase.status} />
              {purchase.purchaseOrderNumber ? (
                <span className="text-muted-foreground">OC {purchase.purchaseOrderNumber}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {requisition.deliveryAddress ? (
        <p className="text-xs text-muted-foreground">Entrega en: {requisition.deliveryAddress}</p>
      ) : null}
      {requisition.notes ? <p className="text-xs text-muted-foreground">Notas: {requisition.notes}</p> : null}
      {requisition.warehouseNotes ? (
        <p className="text-xs text-muted-foreground">Almacén: {requisition.warehouseNotes}</p>
      ) : null}
    </li>
  );
}

type CreatedResult = { requisition: ServiceOrderRequisition; purchase: PurchaseRequest | null; purchaseError: string };

/** Lo que almacén no podrá surtir: partidas fuera de catálogo completas y lo que exceda la existencia. */
function purchaseQuantity(line: DraftLine, stock: Map<string, number> | null) {
  const qty = Number(line.quantity) || 0;
  if (!line.productId) return qty;
  const available = stock?.get(line.productId);
  return available === undefined ? 0 : Math.max(0, qty - Math.max(0, available));
}

function QuoteFulfillmentDialog({
  quote,
  requisitions,
  requester,
  onClose,
  onCreated,
}: {
  quote: Quote;
  requisitions: ServiceOrderRequisition[];
  requester: { username: string; fullName: string | null } | null;
  onClose: () => void;
  onCreated: (result: CreatedResult) => void;
}) {
  const [lines, setLines] = useState<DraftLine[]>(() => buildDraft(quote, requisitions));
  const [stock, setStock] = useState<Map<string, number> | null>(null);
  const [priority, setPriority] = useState<RequisitionPriority>("normal");
  const [neededBy, setNeededBy] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(() =>
    [quote.city, quote.state].filter(Boolean).join(", ")
  );
  const [notes, setNotes] = useState("");
  const [sendToPurchasing, setSendToPurchasing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const ids = [...new Set(quote.lines.map((line) => line.productId).filter(Boolean) as string[])];
    Promise.all(ids.map(async (id) => [id, await getProductAvailableQty(id).catch(() => 0)] as const)).then(
      (entries) => {
        if (active) setStock(new Map(entries));
      }
    );
    return () => {
      active = false;
    };
  }, [quote.lines]);

  const selected = lines.filter((line) => line.include && Number(line.quantity) > 0);
  const units = selected.reduce((sum, line) => sum + Number(line.quantity), 0);
  const toPurchase = selected
    .map((line) => ({ line, quantity: purchaseQuantity(line, stock) }))
    .filter((item) => item.quantity > 0);
  const offCatalogCount = selected.filter((line) => !line.productId).length;

  function updateLine(quoteLineId: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.quoteLineId === quoteLineId ? { ...line, ...patch } : line)));
  }

  async function onSubmit() {
    if (!selected.length) {
      setError("Selecciona al menos una partida con cantidad mayor a 0.");
      return;
    }
    if (!requester?.username) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }
    setSaving(true);
    setError("");
    let requisition: ServiceOrderRequisition;
    try {
      requisition = await createQuoteRequisition({
        quoteId: quote.id,
        requestedBy: requester.username,
        priority,
        neededBy,
        deliveryAddress,
        notes,
        lines: selected.map((line) => ({
          quoteLineId: line.quoteLineId,
          productId: line.productId,
          description: line.description,
          quantity: Number(line.quantity),
          unit: line.unit,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
      setSaving(false);
      return;
    }

    let purchase: PurchaseRequest | null = null;
    let purchaseError = "";
    if (sendToPurchasing && toPurchase.length) {
      const byQuoteLine = new Map(requisition.lines.map((line) => [line.quoteLineId, line]));
      try {
        purchase = await createPurchaseRequest({
          requisitionId: requisition.id,
          priority,
          neededBy,
          justification: `Material para surtir la venta ${quote.folio}${quote.clientName ? ` (${quote.clientName})` : ""}: partidas fuera de catálogo o sin existencia suficiente.`,
          notes,
          requester,
          lines: toPurchase.map(({ line, quantity }) => ({
            requisitionLineId: byQuoteLine.get(line.quoteLineId)?.id ?? null,
            productId: line.productId,
            productSku: line.sku,
            productName: line.productId ? line.description : "",
            description: line.description,
            unit: line.unit,
            quantity,
            stockAtRequest: line.productId ? Math.max(0, stock?.get(line.productId) ?? 0) : 0,
          })),
        });
      } catch (err) {
        purchaseError = err instanceof Error ? err.message : "No se pudo crear la solicitud de compra.";
      }
    }
    setSaving(false);
    onCreated({ requisition, purchase, purchaseError });
  }

  return (
    <ModalShell
      title="Solicitar surtimiento a almacén"
      description={`${quote.folio} · ${quote.clientName || "Sin cliente"}`}
      className="max-w-4xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <Notice tone="error">{error}</Notice>

        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Almacén recibirá la solicitud en su bandeja de surtimiento. La cantidad sugerida es lo cotizado menos lo que
          ya se pidió en solicitudes anteriores. Las partidas fuera de catálogo también se piden: se compran y almacén
          las entrega directo, sin pasar por inventario.
        </p>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">Partida</th>
                <th className="px-3 py-2 text-center">Cotizado</th>
                <th className="px-3 py-2 text-center">Por pedir</th>
                <th className="px-3 py-2 text-center">Disponible</th>
                <th className="px-3 py-2">Solicitar</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const qty = Number(line.quantity) || 0;
                const available = line.productId ? stock?.get(line.productId) : undefined;
                const overQuote = line.include && qty > line.remaining + 0.0001;
                const overStock = line.include && available !== undefined && qty > available;
                return (
                  <tr key={line.quoteLineId} className={cn("border-t border-border align-top", !line.include && "opacity-60")}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="mt-2 size-4 accent-[#3B46A5]"
                        checked={line.include}
                        onChange={(e) => updateLine(line.quoteLineId, { include: e.target.checked })}
                        aria-label={`Incluir ${line.description}`}
                      />
                    </td>
                    <td className="min-w-56 px-3 py-2">
                      <p className="font-medium">{line.description}</p>
                      {line.productId ? (
                        <p className="text-xs text-muted-foreground">{line.sku || "Sin SKU"}</p>
                      ) : (
                        <OffCatalogTag />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {formatQty(line.quoted)} {line.unit}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {line.remaining > 0 ? formatQty(line.remaining) : <span className="text-emerald-700 dark:text-emerald-300">Ya pedido</span>}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {!line.productId ? (
                        <span className="text-muted-foreground">Por comprar</span>
                      ) : available === undefined ? (
                        "…"
                      ) : (
                        formatQty(available)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(fieldClass, "h-9 w-24")}
                        value={line.quantity}
                        disabled={!line.include}
                        onChange={(e) => updateLine(line.quoteLineId, { quantity: e.target.value })}
                      />
                      {overQuote ? (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">Excede lo cotizado</p>
                      ) : null}
                      {overStock ? (
                        <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">Sin existencia suficiente</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Prioridad</span>
            <select
              className={fieldClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value as RequisitionPriority)}
            >
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Se necesita para (opcional)</span>
            <input type="date" className={fieldClass} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Lugar de entrega</span>
          <input
            className={fieldClass}
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Hospital, dirección o “recoge en almacén”"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Notas para almacén</span>
          <textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {toPurchase.length ? (
          <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#3B46A5]"
                checked={sendToPurchasing}
                onChange={(e) => setSendToPurchasing(e.target.checked)}
              />
              <span>
                <span className="flex items-center gap-1 font-medium text-violet-700 dark:text-violet-300">
                  <ShoppingCart className="size-3.5" /> Enviar también a compras para generar la orden de compra
                </span>
                <span className="block text-xs text-muted-foreground">
                  {offCatalogCount ? `${offCatalogCount} partida(s) fuera de catálogo` : ""}
                  {offCatalogCount && toPurchase.length > offCatalogCount ? " y " : ""}
                  {toPurchase.length > offCatalogCount
                    ? `${toPurchase.length - offCatalogCount} sin existencia suficiente`
                    : ""}
                  . Se crea una solicitud de compra ligada a este surtimiento; compras la convierte en orden de compra.
                </span>
              </span>
            </label>
            {sendToPurchasing ? (
              <ul className="ml-6 list-disc text-xs text-muted-foreground">
                {toPurchase.map(({ line, quantity }) => (
                  <li key={line.quoteLineId}>
                    {formatQty(quantity)} {line.unit} · {line.description}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          <span className="mr-auto text-xs text-muted-foreground">
            {selected.length} partida(s) · {formatQty(units)} unidad(es)
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className={primaryButtonClass}
            disabled={saving || !selected.length}
            onClick={() => void onSubmit()}
          >
            <PackageCheck className="size-4" />
            {saving ? "Enviando…" : sendToPurchasing && toPurchase.length ? "Enviar a almacén y compras" : "Enviar a almacén"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
