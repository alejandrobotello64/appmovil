"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Copy,
  MessageCircle,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { getClientContacts, getClients } from "@/lib/clients/storage";
import type { Client, ClientContact } from "@/lib/clients/types";
import { listServiceOrderSummaries } from "@/lib/service-orders/storage";
import type { ServiceOrderSummary } from "@/lib/service-orders/types";
import {
  cancelQualitySurvey,
  createQualitySurvey,
  deleteQualitySurvey,
  getQualitySurveys,
  markSurveySent,
  surveyWhatsAppHref,
} from "@/lib/quality/storage";
import {
  CSAT_QUESTIONS,
  csatScoreLabel,
  publicSurveyUrl,
  surveyAverage,
  surveyStatusLabel,
  type QualitySurvey,
} from "@/lib/quality/types";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20";

function statusClass(status: QualitySurvey["status"]) {
  if (status === "respondida") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "enviada") {
    return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
  }
  if (status === "cancelada") {
    return "bg-muted text-muted-foreground";
  }
  return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
}

function formatWhen(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function QualityPanel() {
  const { canWrite } = usePermissions("calidad");
  const [items, setItems] = useState<QualitySurvey[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<ServiceOrderSummary[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<QualitySurvey | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");

  async function refresh() {
    const rows = await getQualitySurveys();
    setItems(rows);
    setDetail((current) =>
      current ? (rows.find((row) => row.id === current.id) ?? current) : null
    );
  }

  useEffect(() => {
    void Promise.all([
      refresh(),
      getClients().catch(() => [] as Client[]),
      listServiceOrderSummaries().catch(() => [] as ServiceOrderSummary[]),
    ])
      .then(([, clientRows, orderRows]) => {
        setClients(clientRows.filter((row) => row.isActive));
        setOrders(orderRows);
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las encuestas."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!clientId) {
      setContacts([]);
      return;
    }
    void getClientContacts(clientId)
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [clientId]);

  const clientOrders = useMemo(
    () =>
      orders.filter((order) =>
        clientId ? order.clientId === clientId : true
      ),
    [orders, clientId]
  );

  const stats = useMemo(() => {
    const answered = items.filter((item) => item.status === "respondida");
    const avgs = answered
      .map(surveyAverage)
      .filter((value): value is number => value !== null);
    const recommend = answered.filter((item) => item.wouldRecommend === true)
      .length;
    return {
      total: items.length,
      sent: items.filter((item) => item.status === "enviada").length,
      answered: answered.length,
      average:
        avgs.length === 0
          ? null
          : Number(
              (avgs.reduce((sum, value) => sum + value, 0) / avgs.length).toFixed(
                2
              )
            ),
      recommendPct:
        answered.length === 0
          ? null
          : Math.round((recommend / answered.length) * 100),
    };
  }, [items]);

  function resetForm() {
    setClientId("");
    setClientName("");
    setContactName("");
    setContactPhone("");
    setServiceOrderId("");
  }

  function applyClient(nextId: string, keepOrder = false) {
    setClientId(nextId);
    if (!keepOrder) setServiceOrderId("");
    const client = clients.find((row) => row.id === nextId);
    if (!client) {
      setClientName("");
      setContactName("");
      setContactPhone("");
      return;
    }
    setClientName(client.name);
    setContactName(client.contactName);
    setContactPhone(client.phone);
  }

  function applyContact(contactId: string) {
    const contact = contacts.find((row) => row.id === contactId);
    if (!contact) return;
    setContactName(contact.name);
    if (contact.phone.trim()) setContactPhone(contact.phone);
  }

  function applyOrder(orderId: string) {
    setServiceOrderId(orderId);
    const order = orders.find((row) => row.id === orderId);
    if (!order) return;
    if (order.clientId && order.clientId !== clientId) {
      applyClient(order.clientId, true);
    }
    if (!clientName && order.clientName) setClientName(order.clientName);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const session = getSession();
      const order = orders.find((row) => row.id === serviceOrderId);
      const created = await createQualitySurvey({
        clientId: clientId || null,
        clientName,
        contactName,
        contactPhone,
        serviceOrderId: serviceOrderId || null,
        serviceOrderFolio: order?.folio ?? "",
        createdBy: session?.fullName || session?.username || "",
      });
      await refresh();
      setFormOpen(false);
      resetForm();
      setDetail(created);
      setMessage(
        `${created.folio} lista. Envíala por WhatsApp para que el cliente la responda.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear la encuesta."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendWhatsApp(survey: QualitySurvey) {
    if (!canWrite) return;
    setError("");
    try {
      const sent =
        survey.status === "borrador"
          ? await markSurveySent(survey.id)
          : survey;
      await refresh();
      setDetail(sent);
      window.open(surveyWhatsAppHref(sent), "_blank");
      setMessage(`WhatsApp abierto para ${sent.contactPhone}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo preparar el envío por WhatsApp."
      );
    }
  }

  async function handleCopyLink(survey: QualitySurvey) {
    try {
      if (canWrite && survey.status === "borrador") {
        await markSurveySent(survey.id);
        await refresh();
      }
      await navigator.clipboard.writeText(publicSurveyUrl(survey.token));
      setMessage("Enlace de la encuesta copiado.");
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

  async function handleCancel(survey: QualitySurvey) {
    if (!canWrite) return;
    if (
      !window.confirm(
        `¿Cancelar ${survey.folio}? El cliente ya no podrá responderla.`
      )
    ) {
      return;
    }
    try {
      await cancelQualitySurvey(survey.id);
      await refresh();
      setMessage("Encuesta cancelada.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cancelar la encuesta."
      );
    }
  }

  async function handleDelete(survey: QualitySurvey) {
    if (!canWrite) return;
    if (
      !window.confirm(
        `¿Eliminar ${survey.folio}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await deleteQualitySurvey(survey.id);
      if (detail?.id === survey.id) setDetail(null);
      await refresh();
      setMessage("Encuesta eliminada.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar la encuesta."
      );
    }
  }

  const selectedOrder = orders.find((row) => row.id === serviceOrderId);

  return (
    <div className="space-y-4">
      {!canWrite ? (
        <ReadOnlyBanner
          visible
          message="Tu rol puede consultar las encuestas, pero no crear ni enviar nuevas."
        />
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Encuestas" value={String(stats.total)} />
        <StatCard label="Pendientes de respuesta" value={String(stats.sent)} />
        <StatCard
          label="Promedio CSAT"
          value={stats.average === null ? "—" : `${stats.average} / 5`}
        />
        <StatCard
          label="Recomendarían MAS"
          value={
            stats.recommendPct === null ? "—" : `${stats.recommendPct}%`
          }
        />
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <BadgeCheck className="size-5 text-[#3B46A5]" />
              Encuestas de satisfacción
            </h2>
            <p className="text-sm text-muted-foreground">
              Crea la encuesta, envíala por WhatsApp y revisa las respuestas del
              cliente en el enlace público.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(true);
                setError("");
                setMessage("");
              }}
              className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <Plus className="size-4" />
              Nueva encuesta
            </Button>
          ) : null}
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Cargando encuestas…
            </p>
          ) : (
            <>
              <ResponsiveDataList
                emptyMessage="Aún no hay encuestas. Crea una y envíala por WhatsApp."
                items={items.map((item) => ({
                  key: item.id,
                  title: item.clientName,
                  subtitle: `${item.contactName || "Sin contacto"} · ${item.contactPhone || "Sin teléfono"}`,
                  badge: (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusClass(item.status)
                      )}
                    >
                      {surveyStatusLabel(item.status)}
                    </span>
                  ),
                  fields: [
                    { label: "Folio", value: item.folio },
                    {
                      label: "Orden",
                      value: item.serviceOrderFolio || "—",
                    },
                    {
                      label: "Promedio",
                      value:
                        surveyAverage(item) === null
                          ? "—"
                          : String(surveyAverage(item)),
                    },
                  ],
                  actions: (
                    <SurveyActions
                      item={item}
                      canWrite={canWrite}
                      onOpen={() => setDetail(item)}
                      onWhatsApp={() => void handleSendWhatsApp(item)}
                      onCopy={() => void handleCopyLink(item)}
                      onCancel={() => void handleCancel(item)}
                      onDelete={() => void handleDelete(item)}
                    />
                  ),
                }))}
              />
              <DesktopTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Folio</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">WhatsApp</th>
                      <th className="px-3 py-2 font-medium">Orden</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium">Promedio</th>
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          Aún no hay encuestas. Crea una y envíala por WhatsApp.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">{item.folio}</td>
                          <td className="px-3 py-2">
                            <p>{item.clientName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.contactName || "Sin contacto"}
                            </p>
                          </td>
                          <td className="px-3 py-2">{item.contactPhone || "—"}</td>
                          <td className="px-3 py-2">
                            {item.serviceOrderFolio || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                statusClass(item.status)
                              )}
                            >
                              {surveyStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {surveyAverage(item) ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <SurveyActions
                              item={item}
                              canWrite={canWrite}
                              onOpen={() => setDetail(item)}
                              onWhatsApp={() => void handleSendWhatsApp(item)}
                              onCopy={() => void handleCopyLink(item)}
                              onCancel={() => void handleCancel(item)}
                              onDelete={() => void handleDelete(item)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DesktopTable>
            </>
          )}
        </div>
      </section>

      {formOpen ? (
        <ModalShell
          title="Nueva encuesta de satisfacción"
          description="Se genera un enlace único para que el cliente la responda desde WhatsApp, sin iniciar sesión."
          headerAction={
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          }
        >
          <form className="space-y-4" onSubmit={handleCreate}>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Cliente</span>
              <select
                className={inputClass}
                value={clientId}
                onChange={(event) => applyClient(event.target.value)}
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            {!clientId ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Nombre del cliente</span>
                <input
                  className={inputClass}
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Hospital o institución"
                />
              </label>
            ) : null}
            {contacts.length > 0 ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Contacto del cliente</span>
                <select
                  className={inputClass}
                  defaultValue=""
                  onChange={(event) => applyContact(event.target.value)}
                >
                  <option value="">Usar contacto principal o escribir otro</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Nombre a saludar</span>
                <input
                  className={inputClass}
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  placeholder="Ing. López"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">WhatsApp</span>
                <input
                  required
                  className={inputClass}
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="5512345678"
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Orden de servicio (opcional)
              </span>
              <select
                className={inputClass}
                value={serviceOrderId}
                onChange={(event) => applyOrder(event.target.value)}
              >
                <option value="">Sin ligar a una OS</option>
                {clientOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.folio} · {order.clientName || "Sin cliente"}
                  </option>
                ))}
              </select>
              {selectedOrder ? (
                <p className="text-xs text-muted-foreground">
                  {selectedOrder.equipmentName || "Sin equipo"} ·{" "}
                  {selectedOrder.technician || "Sin técnico"}
                </p>
              ) : null}
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                {submitting ? "Creando…" : "Crear encuesta"}
              </Button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {detail ? (
        <ModalShell
          title={detail.folio}
          description={`${detail.clientName} · ${surveyStatusLabel(detail.status)}`}
          headerAction={
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          }
        >
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Contacto</dt>
                <dd className="font-medium">{detail.contactName || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">WhatsApp</dt>
                <dd className="font-medium">{detail.contactPhone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Orden</dt>
                <dd className="font-medium">
                  {detail.serviceOrderFolio || "Sin ligar"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Enviada</dt>
                <dd className="font-medium">{formatWhen(detail.sentAt)}</dd>
              </div>
            </dl>
            <p className="break-all rounded-xl bg-muted/60 px-3 py-2 text-xs">
              {publicSurveyUrl(detail.token)}
            </p>
            <div className="flex flex-wrap gap-2">
              {canWrite &&
              (detail.status === "borrador" || detail.status === "enviada") ? (
                <Button
                  type="button"
                  onClick={() => void handleSendWhatsApp(detail)}
                  className="bg-[#25D366] text-white hover:opacity-90"
                >
                  <MessageCircle className="size-4" />
                  Enviar por WhatsApp
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCopyLink(detail)}
              >
                <Copy className="size-4" />
                Copiar enlace
              </Button>
            </div>
            {detail.status === "respondida" ? (
              <div className="space-y-3 rounded-xl border border-border p-3">
                <p className="text-sm font-semibold">Respuesta del cliente</p>
                <p className="text-xs text-muted-foreground">
                  {detail.respondentName
                    ? `Respondió ${detail.respondentName} · `
                    : ""}
                  {formatWhen(detail.respondedAt)}
                </p>
                <ul className="space-y-2">
                  {CSAT_QUESTIONS.map((question) => {
                    const value = detail[
                      question.field as keyof QualitySurvey
                    ] as number | null;
                    return (
                      <li
                        key={question.id}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <span>{question.label}</span>
                        <span className="shrink-0 font-medium">
                          {value ?? "—"} · {csatScoreLabel(value)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm">
                  ¿Recomendaría MAS?{" "}
                  <strong>
                    {detail.wouldRecommend === null
                      ? "—"
                      : detail.wouldRecommend
                        ? "Sí"
                        : "No"}
                  </strong>
                </p>
                {detail.comments ? (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm">
                    {detail.comments}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Sin comentarios adicionales.
                  </p>
                )}
                <p className="flex items-center gap-1 text-sm font-medium">
                  <Star className="size-4 text-amber-500" />
                  Promedio {surveyAverage(detail) ?? "—"} / 5
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aún no hay respuesta. El cliente debe abrir el enlace enviado
                por WhatsApp.
              </p>
            )}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SurveyActions({
  item,
  canWrite,
  onOpen,
  onWhatsApp,
  onCopy,
  onCancel,
  onDelete,
}: {
  item: QualitySurvey;
  canWrite: boolean;
  onOpen: () => void;
  onWhatsApp: () => void;
  onCopy: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const canSend =
    canWrite && (item.status === "borrador" || item.status === "enviada");
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
      >
        Ver
      </button>
      {canSend ? (
        <button
          type="button"
          onClick={onWhatsApp}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-3 text-xs font-medium text-[#128C7E]"
        >
          <MessageCircle className="size-3.5" />
          WhatsApp
        </button>
      ) : null}
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
      >
        <Copy className="size-3.5" />
        Enlace
      </button>
      {canWrite && item.status !== "respondida" && item.status !== "cancelada" ? (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
        >
          Cancelar
        </button>
      ) : null}
      {canWrite ? (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
