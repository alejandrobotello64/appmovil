"use client";

import { useState } from "react";
import {
  Ban,
  CheckCircle2,
  FileDown,
  HandHelping,
  PackageCheck,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { downloadToolRequestPdf } from "@/lib/tools/pdf";
import {
  closeToolRequest,
  deliverToolRequest,
  resolvePerson,
  returnToolRequest,
} from "@/lib/tools/storage";
import {
  isRequestOverdue,
  lineOutstanding,
  requestOutstanding,
  RETURN_CONDITIONS,
  returnConditionLabel,
  TOOL_CONDITIONS,
  TOOL_OUT_STATUSES,
  toolConditionLabel,
  type PersonSnapshot,
  type ReturnCondition,
  type ToolRequest,
  type ToolReturnDetails,
  type ToolWithAvailability,
} from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { fieldClass, formatDate, Notice, primaryButtonClass, StatusBadge, textareaClass } from "./tools-shared";
import { SortableTable } from "@/components/ui/sortable-table";

type Mode = "view" | "deliver" | "return" | "reject";
type Session = { username: string; fullName: string | null };

export type RequestPermissions = {
  canManage: boolean;
  canCancel: boolean;
  canExport: boolean;
};

function PersonBlock({ title, person, date, empty }: { title: string; person: PersonSnapshot; date: string; empty: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-[#00BFFF] uppercase">{title}</p>
      {person.name ? (
        <>
          <p className="mt-0.5 text-sm font-semibold">{person.name}</p>
          <p className="text-xs text-muted-foreground">
            {[person.jobTitle, person.department].filter(Boolean).join(" · ") || "Sin puesto registrado"}
          </p>
          <p className="text-xs text-muted-foreground">
            {[person.employeeNumber ? `No. ${person.employeeNumber}` : "", person.phone].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(date, true)}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export function ToolRequestDetail({
  request,
  tools,
  session,
  today,
  permissions,
  onClose,
  onChanged,
}: {
  request: ToolRequest;
  tools: ToolWithAvailability[];
  session: Session;
  today: Date;
  permissions: RequestPermissions;
  onClose: () => void;
  onChanged: (request: ToolRequest, message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deliverDraft, setDeliverDraft] = useState<Record<string, { quantity: number; condition: string }>>({});
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [returnDraft, setReturnDraft] = useState<Record<string, { quantity: number; condition: ReturnCondition }>>({});
  const [receivedBy, setReceivedBy] = useState("");
  const [returnedBy, setReturnedBy] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [reason, setReason] = useState("");

  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  const isOut = TOOL_OUT_STATUSES.includes(request.status);
  const overdue = isRequestOverdue(request, today);
  const outstanding = requestOutstanding(request);
  const sessionName = session.fullName || session.username;

  function startDeliver() {
    const draft: typeof deliverDraft = {};
    for (const line of request.lines) {
      const tool = line.toolId ? toolById.get(line.toolId) : undefined;
      draft[line.id] = {
        quantity: Math.min(line.quantityRequested, tool?.quantityAvailable ?? 0),
        condition: tool && tool.condition !== "baja" ? tool.condition : "bueno",
      };
    }
    setDeliverDraft(draft);
    setDeliveryNotes("");
    setError("");
    setMode("deliver");
  }

  function startReturn() {
    const draft: typeof returnDraft = {};
    for (const line of request.lines) {
      draft[line.id] = { quantity: lineOutstanding(line), condition: "bueno" };
    }
    setReturnDraft(draft);
    setReceivedBy(sessionName);
    setReturnedBy(request.requester.name);
    setReturnNotes("");
    setError("");
    setMode("return");
  }

  async function run(action: () => Promise<ToolRequest>, message: string) {
    setBusy(true);
    setError("");
    try {
      const updated = await action();
      setMode("view");
      onChanged(updated, message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  }

  function onDeliver() {
    void run(async () => {
      const deliverer = await resolvePerson(session);
      return deliverToolRequest(request.id, {
        deliverer,
        notes: deliveryNotes,
        lines: request.lines.map((line) => ({
          lineId: line.id,
          quantity: deliverDraft[line.id]?.quantity ?? 0,
          conditionOut: deliverDraft[line.id]?.condition ?? "",
        })),
      });
    }, `Vale ${request.folio} entregado.`);
  }

  function onReturn() {
    void run(
      () =>
        returnToolRequest(request.id, {
          receivedBy,
          returnedBy,
          notes: returnNotes,
          lines: request.lines.map((line) => ({
            lineId: line.id,
            quantity: returnDraft[line.id]?.quantity ?? 0,
            condition: returnDraft[line.id]?.condition ?? "bueno",
          })),
        }),
      `Devolución registrada en ${request.folio}.`
    );
  }

  function onReject() {
    void run(() => closeToolRequest(request.id, "rechazada", sessionName, reason), `Vale ${request.folio} rechazado.`);
  }

  function onCancel() {
    if (!window.confirm(`¿Cancelar la solicitud ${request.folio}?`)) return;
    void run(() => closeToolRequest(request.id, "cancelada", sessionName, ""), `Solicitud ${request.folio} cancelada.`);
  }

  async function onPdf() {
    setError("");
    try {
      await downloadToolRequestPdf(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    }
  }

  const returns = request.events.filter((event) => event.eventType === "devolucion");

  return (
    <ModalShell
      title={`Vale ${request.folio}`}
      description={request.purpose}
      className="max-w-4xl"
      headerAction={
        <div className="flex items-center gap-1">
          {permissions.canExport ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void onPdf()}>
              <FileDown className="size-3.5" /> PDF
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <StatusBadge status={request.status} overdue={overdue} />
          <span className="text-muted-foreground">
            Devolución comprometida:{" "}
            <span className={cn("font-medium text-foreground", overdue && "text-destructive")}>
              {formatDate(request.expectedReturnAt)}
            </span>
          </span>
          {request.serviceOrderFolio ? (
            <span className="text-muted-foreground">
              OS <span className="font-medium text-foreground">{request.serviceOrderFolio}</span>
              {request.clientName ? ` · ${request.clientName}` : ""}
            </span>
          ) : null}
          {isOut ? (
            <span className="text-muted-foreground">
              Pendientes de devolver: <span className="font-semibold text-foreground">{outstanding}</span>
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PersonBlock title="Solicita" person={request.requester} date={request.requestedAt} empty="—" />
          <PersonBlock
            title="Entrega (almacén)"
            person={request.deliverer}
            date={request.deliveredAt}
            empty={request.status === "solicitada" ? "Pendiente de entrega" : "No se entregó"}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <SortableTable className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Herramienta</th>
                <th className="px-2 py-2 text-center">Solic.</th>
                <th className="px-2 py-2 text-center">Entr.</th>
                <th className="px-2 py-2 text-center">Dev.</th>
                <th className="px-2 py-2 text-center">Pend.</th>
                {mode === "deliver" ? <th className="px-3 py-2">Entregar ahora</th> : null}
                {mode === "return" ? <th className="px-3 py-2">Devolución</th> : null}
                {mode === "view" ? <th className="px-3 py-2">Estado</th> : null}
              </tr>
            </thead>
            <tbody>
              {request.lines.map((line) => {
                const tool = line.toolId ? toolById.get(line.toolId) : undefined;
                const pending = lineOutstanding(line);
                const delivered = Boolean(request.deliveredAt);
                return (
                  <tr key={line.id} className="border-t border-border align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{line.toolName}</p>
                      <p className="text-xs text-muted-foreground">
                        {[line.toolCode, line.toolBrand, line.toolModel, line.toolSerial ? `S/N ${line.toolSerial}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums">{line.quantityRequested}</td>
                    <td className="px-2 py-2.5 text-center tabular-nums">{delivered ? line.quantityDelivered : "—"}</td>
                    <td className="px-2 py-2.5 text-center tabular-nums">
                      {delivered ? line.quantityReturned : "—"}
                      {line.quantityLost ? (
                        <span className="block text-[11px] text-destructive">{line.quantityLost} extraviada(s)</span>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2.5 text-center font-semibold tabular-nums",
                        pending > 0 && "text-amber-700 dark:text-amber-300"
                      )}
                    >
                      {delivered ? pending : "—"}
                    </td>
                    {mode === "view" ? (
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {line.conditionOut ? <p>Salida: {toolConditionLabel(line.conditionOut)}</p> : null}
                        {line.conditionIn ? <p>Regreso: {returnConditionLabel(line.conditionIn)}</p> : null}
                        {!line.conditionOut && !line.conditionIn ? "—" : null}
                      </td>
                    ) : null}
                    {mode === "deliver" ? (
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={Math.min(line.quantityRequested, tool?.quantityAvailable ?? 0)}
                            aria-label={`Piezas a entregar de ${line.toolName}`}
                            className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-sm tabular-nums"
                            value={deliverDraft[line.id]?.quantity ?? 0}
                            onChange={(e) =>
                              setDeliverDraft((current) => ({
                                ...current,
                                [line.id]: {
                                  quantity: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                  condition: current[line.id]?.condition ?? "bueno",
                                },
                              }))
                            }
                          />
                          <select
                            aria-label={`Estado de salida de ${line.toolName}`}
                            className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                            value={deliverDraft[line.id]?.condition ?? "bueno"}
                            onChange={(e) =>
                              setDeliverDraft((current) => ({
                                ...current,
                                [line.id]: { quantity: current[line.id]?.quantity ?? 0, condition: e.target.value },
                              }))
                            }
                          >
                            {TOOL_CONDITIONS.filter((c) => c.id !== "baja").map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {tool ? `${tool.quantityAvailable} disponibles` : "Ya no está en el catálogo"}
                        </p>
                      </td>
                    ) : null}
                    {mode === "return" ? (
                      <td className="px-3 py-2">
                        {pending > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={pending}
                              aria-label={`Piezas devueltas de ${line.toolName}`}
                              className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-sm tabular-nums"
                              value={returnDraft[line.id]?.quantity ?? 0}
                              onChange={(e) =>
                                setReturnDraft((current) => ({
                                  ...current,
                                  [line.id]: {
                                    quantity: Math.min(pending, Math.max(0, Math.round(Number(e.target.value) || 0))),
                                    condition: current[line.id]?.condition ?? "bueno",
                                  },
                                }))
                              }
                            />
                            <select
                              aria-label={`Estado de regreso de ${line.toolName}`}
                              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                              value={returnDraft[line.id]?.condition ?? "bueno"}
                              onChange={(e) =>
                                setReturnDraft((current) => ({
                                  ...current,
                                  [line.id]: {
                                    quantity: current[line.id]?.quantity ?? 0,
                                    condition: e.target.value as ReturnCondition,
                                  },
                                }))
                              }
                            >
                              {RETURN_CONDITIONS.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="size-3.5" /> Completa
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </SortableTable>
        </div>

        {mode === "deliver" ? (
          <div className="space-y-3 rounded-xl border border-[#00BFFF]/30 bg-[#00BFFF]/5 p-3">
            <p className="text-sm">
              Entrega: <span className="font-medium">{sessionName}</span>. Si no hay piezas suficientes, entrega
              menos o deja en 0 las que no salen.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Notas de entrega</span>
              <textarea
                className={textareaClass}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Accesorios incluidos, estuche, observaciones…"
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setMode("view")}>
                Regresar
              </Button>
              <Button type="button" disabled={busy} className={cn("h-10 px-4", primaryButtonClass)} onClick={onDeliver}>
                <PackageCheck className="size-4" /> {busy ? "Guardando…" : "Confirmar entrega"}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "return" ? (
          <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Recibe en almacén *</span>
                <input className={fieldClass} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Devuelve</span>
                <input className={fieldClass} value={returnedBy} onChange={(e) => setReturnedBy(e.target.value)} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">Notas de la devolución</span>
                <textarea
                  className={textareaClass}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Daños, faltantes, limpieza…"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Puedes devolver una parte ahora y el resto después; todo queda en este mismo vale. Si marcas una
              pieza como dañada, la herramienta cambia a «Dañado» en el catálogo; si la marcas como extraviada,
              se descuenta de las existencias.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setMode("view")}>
                Regresar
              </Button>
              <Button type="button" disabled={busy} className={cn("h-10 px-4", primaryButtonClass)} onClick={onReturn}>
                <Undo2 className="size-4" /> {busy ? "Guardando…" : "Registrar devolución"}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "reject" ? (
          <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Motivo del rechazo *</span>
              <input
                className={fieldClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Herramienta en calibración"
                autoFocus
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="h-10 px-3" onClick={() => setMode("view")}>
                Regresar
              </Button>
              <Button type="button" variant="destructive" disabled={busy} className="h-10 px-4" onClick={onReject}>
                <Ban className="size-4" /> Rechazar solicitud
              </Button>
            </div>
          </div>
        ) : null}

        <Notice tone="error">{error}</Notice>

        {mode === "view" ? (
          <div className="flex flex-wrap gap-2">
            {permissions.canManage && request.status === "solicitada" ? (
              <>
                <Button type="button" className={cn("h-10 px-4", primaryButtonClass)} onClick={startDeliver}>
                  <HandHelping className="size-4" /> Entregar herramientas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-3"
                  onClick={() => {
                    setReason("");
                    setMode("reject");
                  }}
                >
                  <Ban className="size-4" /> Rechazar
                </Button>
              </>
            ) : null}
            {permissions.canManage && isOut && outstanding > 0 ? (
              <Button type="button" className={cn("h-10 px-4", primaryButtonClass)} onClick={startReturn}>
                <Undo2 className="size-4" /> Registrar devolución
              </Button>
            ) : null}
            {permissions.canCancel && request.status === "solicitada" ? (
              <Button type="button" variant="outline" className="h-10 px-3" disabled={busy} onClick={onCancel}>
                <XCircle className="size-4" /> Cancelar solicitud
              </Button>
            ) : null}
          </div>
        ) : null}

        {request.notes || request.deliveryNotes || request.closedReason ? (
          <div className="space-y-1 text-sm">
            {request.notes ? (
              <p>
                <span className="text-muted-foreground">Notas de la solicitud:</span> {request.notes}
              </p>
            ) : null}
            {request.deliveryNotes ? (
              <p>
                <span className="text-muted-foreground">Notas de entrega:</span> {request.deliveryNotes}
              </p>
            ) : null}
            {request.closedReason ? (
              <p>
                <span className="text-muted-foreground">Motivo:</span> {request.closedReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {returns.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Devoluciones</p>
            {returns.map((event) => {
              const details = event.details as ToolReturnDetails;
              return (
                <div key={event.id} className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-medium">{formatDate(event.createdAt, true)}</p>
                  <p className="text-xs text-muted-foreground">
                    Recibió: {details.receivedBy || event.actor} · Devolvió: {details.returnedBy || "—"}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {(details.lines ?? []).map((item) => (
                      <li key={item.lineId}>
                        {item.quantity} × {item.toolName} —{" "}
                        <span
                          className={cn(
                            (item.condition === "danado" || item.condition === "extraviada") && "text-destructive"
                          )}
                        >
                          {returnConditionLabel(item.condition)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {details.notes ? <p className="mt-1 text-xs text-muted-foreground">{details.notes}</p> : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium">Historial del vale</p>
          <ol className="space-y-2 border-l border-border pl-4">
            {request.events.map((event) => (
              <li key={event.id} className="relative text-sm">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-[#3B46A5]" />
                <p>{event.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.createdAt, true)}
                  {event.actor ? ` · ${event.actor}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </ModalShell>
  );
}
