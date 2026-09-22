"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  FileDown,
  Plus,
  Search,
  Trash2,
  MessageSquarePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { getClients } from "@/lib/clients/storage";
import type { Client } from "@/lib/clients/types";
import { getInventoryItems } from "@/lib/inventory/storage";
import {
  INVENTORY_CATEGORIES,
  type InventoryCategoryId,
  type InventoryItem,
} from "@/lib/inventory/types";
import { MEXICO_STATES } from "@/lib/location/mexico-states";
import { daysUntilExpiry } from "@/lib/inventory/expiry";
import { downloadQuotePdf } from "@/lib/quotes/pdf";
import {
  addQuoteFollowUp,
  createQuote,
  deleteQuote,
  getQuotes,
  setQuoteStatus,
  updateQuote,
} from "@/lib/quotes/storage";
import {
  QUOTE_PIPELINE_STATUSES,
  QUOTE_STATUSES,
  computeQuoteTotals,
  lineAmount,
  quoteStatusLabel,
  type Quote,
  type QuoteInput,
  type QuoteLineInput,
  type QuoteStatus,
} from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

type DraftLine = QuoteLineInput & {
  key: string;
  categoryFilter: InventoryCategoryId | "all";
};

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function dueTone(date: string) {
  const days = daysUntilExpiry(date);
  if (days === null) return "text-muted-foreground";
  if (days < 0) return "text-destructive";
  if (days <= 3) return "text-rose-700 dark:text-rose-300";
  if (days <= 7) return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
}

const EMPTY: QuoteInput = {
  title: "",
  clientId: null,
  clientName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  city: "",
  state: "",
  status: "borrador",
  quoteDate: new Date().toISOString().slice(0, 10),
  validUntil: "",
  nextFollowUp: "",
  taxRate: 16,
  discount: 0,
  salesperson: "",
  probability: 50,
  notes: "",
};

export function QuotesPanel() {
  const { canWrite } = usePermissions("cotizaciones");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("abiertas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [form, setForm] = useState<QuoteInput>(EMPTY);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [quoteRows, clientRows, catalog] = await Promise.all([
        getQuotes(),
        getClients(),
        getInventoryItems(),
      ]);
      setQuotes(quoteRows);
      setClients(clientRows.filter((client) => client.isActive));
      setItems(catalog);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las cotizaciones."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selected = useMemo(
    () => quotes.find((item) => item.id === selectedId) ?? null,
    [quotes, selectedId]
  );

  const filtered = useMemo(() => {
    let rows = quotes;
    if (statusFilter === "abiertas") {
      rows = rows.filter(
        (item) =>
          !["aceptada", "rechazada", "vencida", "cancelada"].includes(
            item.status
          )
      );
    } else if (statusFilter !== "todos") {
      rows = rows.filter((item) => item.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((item) =>
        [
          item.folio,
          item.title,
          item.clientName,
          item.contactName,
          item.salesperson,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [quotes, statusFilter, search]);

  const stats = useMemo(() => {
    const open = quotes.filter(
      (item) =>
        !["aceptada", "rechazada", "vencida", "cancelada"].includes(item.status)
    );
    const followUps = open.filter((item) => {
      const days = daysUntilExpiry(item.nextFollowUp);
      return days !== null && days <= 3;
    });
    const totalOpen = open.reduce((sum, item) => sum + item.total, 0);
    return { open: open.length, followUps: followUps.length, totalOpen };
  }, [quotes]);

  const draftTotals = useMemo(
    () =>
      computeQuoteTotals(
        lines.filter((line) => line.description.trim()),
        form.discount ?? 0,
        form.taxRate ?? 16
      ),
    [lines, form.discount, form.taxRate]
  );

  function itemsForLine(line: DraftLine) {
    if (line.categoryFilter === "all") return items;
    return items.filter((item) => item.category === line.categoryFilter);
  }

  function openCreate() {
    const session = getSession();
    setEditing(null);
    setForm({
      ...EMPTY,
      salesperson: session?.fullName || session?.username || "",
      quoteDate: new Date().toISOString().slice(0, 10),
    });
    setLines([
      {
        key: crypto.randomUUID(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        unit: "pza",
        categoryFilter: "all",
        productId: null,
      },
    ]);
    setFormOpen(true);
  }

  function openEdit(quote: Quote) {
    setEditing(quote);
    setForm({
      title: quote.title,
      clientId: quote.clientId,
      clientName: quote.clientName,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      city: quote.city,
      state: quote.state,
      status: quote.status,
      quoteDate: quote.quoteDate,
      validUntil: quote.validUntil,
      nextFollowUp: quote.nextFollowUp,
      taxRate: quote.taxRate,
      discount: quote.discount,
      salesperson: quote.salesperson,
      probability: quote.probability,
      notes: quote.notes,
    });
    setLines(
      quote.lines.length
        ? quote.lines.map((line) => ({
            key: line.id,
            productId: line.productId,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            notes: line.notes,
            categoryFilter: "all" as const,
          }))
        : [
            {
              key: crypto.randomUUID(),
              description: "",
              quantity: 1,
              unitPrice: 0,
              unit: "pza",
              categoryFilter: "all" as const,
              productId: null,
            },
          ]
    );
    setFormOpen(true);
    setSelectedId(quote.id);
  }

  function applyClient(clientId: string) {
    const client = clients.find((row) => row.id === clientId);
    setForm((prev) => ({
      ...prev,
      clientId: clientId || null,
      clientName: client?.name ?? prev.clientName,
      contactName: client?.contactName || prev.contactName,
      contactEmail: client?.email || prev.contactEmail,
      contactPhone: client?.phone || prev.contactPhone,
      city: client?.city || prev.city,
      state: client?.state || prev.state,
    }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const session = getSession();
      const validLines = lines.filter(
        (line) => line.description.trim() && line.quantity > 0
      );
      const payload: QuoteInput = {
        ...form,
        createdBy: session?.username ?? "",
        lines: validLines,
      };
      const saved = editing
        ? await updateQuote(editing.id, payload)
        : await createQuote(payload);
      setMessage(`Cotización ${saved.folio} guardada.`);
      setFormOpen(false);
      setEditing(null);
      setSelectedId(saved.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(quote: Quote, status: QuoteStatus) {
    if (!canWrite) return;
    try {
      await setQuoteStatus(quote.id, status, getSession()?.username ?? "");
      setMessage(`Estatus: ${quoteStatusLabel(status)}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar.");
    }
  }

  async function handleFollowUp(quote: Quote) {
    if (!canWrite) return;
    try {
      await addQuoteFollowUp({
        quoteId: quote.id,
        message: followUpText,
        nextFollowUp: followUpDate,
        createdBy: getSession()?.username ?? "",
      });
      setFollowUpText("");
      setFollowUpDate("");
      setMessage("Seguimiento registrado.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el seguimiento."
      );
    }
  }

  async function handleDelete(quote: Quote) {
    if (!canWrite) return;
    if (!window.confirm(`¿Eliminar ${quote.folio}?`)) return;
    try {
      await deleteQuote(quote.id);
      if (selectedId === quote.id) setSelectedId(null);
      setMessage("Cotización eliminada.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  function handlePdf(quote: Quote) {
    void downloadQuotePdf(quote)
      .then(() => setMessage(`PDF ${quote.folio} descargado.`))
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "No se pudo generar el PDF."
        )
      );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Cotizaciones</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Arma partidas, da seguimiento y descarga PDF listo para enviar al
              cliente.
            </p>
          </div>
          {canWrite ? (
            <Button
              onClick={openCreate}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <Plus className="size-4" />
              Nueva cotización
            </Button>
          ) : null}
        </div>
        <div className="mt-4">
          <ReadOnlyBanner visible={!canWrite} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Abiertas</p>
            <p className="text-xl font-semibold">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Seguimiento ≤ 3 días</p>
            <p className="text-xl font-semibold">{stats.followUps}</p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Monto abierto</p>
            <p className="text-lg font-semibold">{money(stats.totalOpen)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar folio, cliente, vendedor..."
              className={cn(fieldClass, "pl-9")}
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={cn(fieldClass, "sm:w-48")}
          >
            <option value="abiertas">Abiertas</option>
            <option value="todos">Todas</option>
            {QUOTE_STATUSES.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}
      </div>

      {formOpen && canWrite ? (
        <form
          onSubmit={handleSave}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <h3 className="font-semibold">
            {editing ? `Editar ${editing.folio}` : "Nueva cotización"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Título</span>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Ej. Cotización insumos quirófano"
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Cliente del catálogo</span>
              <select
                value={form.clientId ?? ""}
                onChange={(e) => applyClient(e.target.value)}
                className={fieldClass}
              >
                <option value="">Manual / sin catálogo</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Cliente *</span>
              <input
                required
                value={form.clientName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    clientId: "",
                    clientName: e.target.value,
                  }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Contacto</span>
              <input
                value={form.contactName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contactName: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Correo</span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contactEmail: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Teléfono</span>
              <input
                value={form.contactPhone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, contactPhone: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Estado</span>
              <select
                value={form.state}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, state: e.target.value }))
                }
                className={fieldClass}
              >
                <option value="">Selecciona</option>
                {MEXICO_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Ciudad</span>
              <input
                value={form.city}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, city: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Fecha</span>
              <input
                type="date"
                value={form.quoteDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, quoteDate: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Vigencia</span>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, validUntil: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Próximo seguimiento</span>
              <input
                type="date"
                value={form.nextFollowUp}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    nextFollowUp: e.target.value,
                  }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Vendedor</span>
              <input
                value={form.salesperson}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, salesperson: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">IVA %</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.taxRate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    taxRate: Number(e.target.value),
                  }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Descuento ($)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.discount}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    discount: Number(e.target.value),
                  }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Notas / condiciones</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Partidas</h4>
              <Button
                type="button"
                variant="outline"
                className="h-8"
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      description: "",
                      quantity: 1,
                      unitPrice: 0,
                      unit: "pza",
                      categoryFilter: "all",
                      productId: null,
                    },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Partida
              </Button>
            </div>
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 lg:grid-cols-6"
              >
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    Tipo inventario
                  </span>
                  <select
                    value={line.categoryFilter}
                    onChange={(e) => {
                      const next =
                        e.target.value === "all"
                          ? "all"
                          : (e.target.value as InventoryCategoryId);
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                categoryFilter: next,
                                productId: null,
                              }
                            : row
                        )
                      );
                    }}
                    className={fieldClass}
                  >
                    <option value="all">Todos</option>
                    {INVENTORY_CATEGORIES.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs text-muted-foreground">
                    Producto / equipo
                  </span>
                  <select
                    value={line.productId ?? ""}
                    onChange={(e) => {
                      const product = items.find(
                        (item) => item.id === e.target.value
                      );
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                productId: e.target.value || null,
                                description:
                                  row.description || product?.name || "",
                                unit: product?.unit || row.unit,
                                unitPrice: product?.unitPrice ?? row.unitPrice,
                              }
                            : row
                        )
                      );
                    }}
                    className={fieldClass}
                  >
                    <option value="">Libre</option>
                    {itemsForLine(line).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 lg:col-span-3">
                  <span className="text-xs text-muted-foreground">
                    Descripción *
                  </span>
                  <input
                    required
                    value={line.description}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, description: e.target.value }
                            : row
                        )
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Cant.</span>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, quantity: Number(e.target.value) }
                            : row
                        )
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">P. unit.</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, unitPrice: Number(e.target.value) }
                            : row
                        )
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <div className="flex items-end justify-between gap-2 lg:col-span-4">
                  <p className="text-sm text-muted-foreground">
                    Importe: {money(lineAmount(line))}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    disabled={lines.length <= 1}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, i) => i !== index)
                      )
                    }
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
              <p>Subtotal: {money(draftTotals.subtotal)}</p>
              <p>IVA: {money(draftTotals.taxAmount)}</p>
              <p className="font-semibold">Total: {money(draftTotals.total)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              {submitting ? "Guardando..." : "Guardar cotización"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando cotizaciones...</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {QUOTE_PIPELINE_STATUSES.map((statusId) => {
                const column = filtered.filter(
                  (item) => item.status === statusId
                );
                return (
                  <div
                    key={statusId}
                    className="rounded-2xl border border-border bg-card p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {quoteStatusLabel(statusId)}
                      </h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {column.length}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {column.map((quote) => (
                        <li key={quote.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(quote.id)}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left hover:bg-muted/40",
                              selectedId === quote.id
                                ? "border-[#3B46A5] bg-muted/30"
                                : "border-border"
                            )}
                          >
                            <p className="text-xs text-muted-foreground">
                              {quote.folio}
                            </p>
                            <p className="text-sm font-medium">
                              {quote.clientName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {quote.title || "Sin título"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                              <span className="text-sm font-semibold">
                                {money(quote.total)}
                              </span>
                              {quote.nextFollowUp ? (
                                <span
                                  className={cn(
                                    "text-[11px] font-medium",
                                    dueTone(quote.nextFollowUp)
                                  )}
                                >
                                  Seg. {quote.nextFollowUp}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      ))}
                      {column.length === 0 ? (
                        <li className="py-4 text-center text-xs text-muted-foreground">
                          Vacío
                        </li>
                      ) : null}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {selected ? (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selected.folio}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selected.clientName} · {quoteStatusLabel(selected.status)}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {money(selected.total)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    onClick={() => handlePdf(selected)}
                  >
                    <FileDown className="size-4" />
                    Descargar PDF
                  </Button>
                  {canWrite ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openEdit(selected)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => void handleDelete(selected)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  {QUOTE_STATUSES.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => void handleStatus(selected, status.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        selected.status === status.id
                          ? "border-transparent bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Contacto: </span>
                  {selected.contactName || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Vendedor: </span>
                  {selected.salesperson || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Vigencia: </span>
                  {selected.validUntil || "—"}
                </p>
                <p className={dueTone(selected.nextFollowUp)}>
                  <span className="text-muted-foreground">Seguimiento: </span>
                  {selected.nextFollowUp || "—"}
                </p>
              </div>

              <ul className="space-y-2">
                {selected.lines.map((line) => (
                  <li
                    key={line.id}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium">{line.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.quantity} {line.unit} × {money(line.unitPrice)}
                          {line.productSku ? ` · ${line.productSku}` : ""}
                        </p>
                      </div>
                      <p className="font-medium">{money(lineAmount(line))}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {canWrite ? (
                <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                  <p className="text-sm font-medium">Registrar seguimiento</p>
                  <textarea
                    rows={2}
                    value={followUpText}
                    onChange={(e) => setFollowUpText(e.target.value)}
                    placeholder="Llamada, correo, visita..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className={cn(fieldClass, "sm:w-44")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleFollowUp(selected)}
                    >
                      <MessageSquarePlus className="size-3.5" />
                      Guardar seguimiento
                    </Button>
                  </div>
                </div>
              ) : null}

              <div>
                <h4 className="font-semibold">Bitácora</h4>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {selected.events.length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      Sin eventos.
                    </li>
                  ) : (
                    selected.events.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <p>{event.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString("es-MX")}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Selecciona una cotización para ver detalle, seguimiento y PDF.
            </section>
          )}
        </div>
      )}
    </section>
  );
}
