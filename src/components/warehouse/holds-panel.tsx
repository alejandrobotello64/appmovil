"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookmarkPlus, CheckCircle2, Plus, Search, Unlock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
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
import {
  cancelInventoryHold,
  createInventoryHold,
  fulfillInventoryHold,
  getInventoryHolds,
  getReservedQuantities,
  releaseInventoryHold,
} from "@/lib/holds/storage";
import {
  HOLD_STATUSES,
  holdStatusLabel,
  type InventoryHold,
  type InventoryHoldLineInput,
} from "@/lib/holds/types";
import {
  buildHoldDueAlerts,
  holdDueLabel,
  holdDueTone,
} from "@/lib/holds/alerts";
import { daysUntilExpiry } from "@/lib/inventory/expiry";
import { MEXICO_STATES } from "@/lib/location/mexico-states";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

type DraftLine = InventoryHoldLineInput & {
  key: string;
  categoryFilter: InventoryCategoryId | "all";
};

function locationLabel(city: string, state: string) {
  return [city, state].filter(Boolean).join(", ");
}

export function HoldsPanel() {
  const { canWrite } = usePermissions("apartados");
  const [holds, setHolds] = useState<InventoryHold[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reserved, setReserved] = useState<Map<string, number>>(new Map());
  const [statusFilter, setStatusFilter] = useState<string>("activo");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientState, setClientState] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: crypto.randomUUID(),
      productId: "",
      quantity: 1,
      notes: "",
      categoryFilter: "all",
    },
  ]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [holdRows, catalog, reservedMap, clientRows] = await Promise.all([
        getInventoryHolds(),
        getInventoryItems(),
        getReservedQuantities(),
        getClients(),
      ]);
      setHolds(holdRows);
      setItems(catalog);
      setReserved(reservedMap);
      setClients(clientRows.filter((client) => client.isActive));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar apartados."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    let rows = holds;
    if (statusFilter !== "todos") {
      rows = rows.filter((hold) => hold.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((hold) =>
        [
          hold.folio,
          hold.projectName,
          hold.clientName,
          hold.clientCity,
          hold.clientState,
          hold.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [holds, statusFilter, search]);

  const dueAlerts = useMemo(() => buildHoldDueAlerts(holds), [holds]);

  function dueBadge(hold: InventoryHold) {
    if (hold.status !== "activo" || !hold.neededBy) return null;
    const days = daysUntilExpiry(hold.neededBy);
    if (days === null) return null;
    const bucket =
      days < 0
        ? ("vencido" as const)
        : days <= 5
          ? ("5" as const)
          : days <= 10
            ? ("10" as const)
            : days <= 15
              ? ("15" as const)
              : days <= 30
                ? ("30" as const)
                : days <= 60
                  ? ("60" as const)
                  : null;
    const label = holdDueLabel(days, bucket);
    if (!label) return null;
    return (
      <span
        className={cn(
          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
          holdDueTone(bucket)
        )}
      >
        {label}
      </span>
    );
  }

  function availableFor(productId: string) {
    const item = items.find((row) => row.id === productId);
    if (!item) return 0;
    const reservedQty = reserved.get(productId) ?? 0;
    return Math.max(0, item.quantity - reservedQty);
  }

  function itemsForLine(line: DraftLine) {
    if (line.categoryFilter === "all") return items;
    return items.filter((item) => item.category === line.categoryFilter);
  }

  function applyClient(selectedId: string) {
    setClientId(selectedId);
    if (!selectedId) {
      setClientName("");
      setClientCity("");
      setClientState("");
      return;
    }
    const client = clients.find((row) => row.id === selectedId);
    if (!client) return;
    setClientName(client.name);
    setClientCity(client.city);
    setClientState(client.state);
  }

  function resetForm() {
    setProjectName("");
    setClientId("");
    setClientName("");
    setClientCity("");
    setClientState("");
    setNeededBy("");
    setNotes("");
    setLines([
      {
        key: crypto.randomUUID(),
        productId: "",
        quantity: 1,
        notes: "",
        categoryFilter: "all",
      },
    ]);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const session = getSession();
      if (!neededBy) {
        throw new Error("La fecha requerida es obligatoria para las alarmas.");
      }
      const validLines = lines.filter((line) => line.productId && line.quantity > 0);
      if (!validLines.length) {
        throw new Error("Agrega al menos un artículo con cantidad.");
      }
      const created = await createInventoryHold({
        projectName,
        clientName,
        clientCity,
        clientState,
        neededBy,
        notes,
        createdBy: session?.username ?? "",
        lines: validLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          notes: line.notes,
        })),
      });
      setMessage(`Apartado ${created.folio} creado para ${created.projectName}.`);
      setFormOpen(false);
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el apartado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRelease(hold: InventoryHold) {
    if (!canWrite) return;
    const ok = window.confirm(
      `¿Liberar el apartado ${hold.folio}? El stock vuelve a estar disponible.`
    );
    if (!ok) return;
    try {
      await releaseInventoryHold(hold.id);
      setMessage(`Apartado ${hold.folio} liberado.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo liberar.");
    }
  }

  async function handleCancel(hold: InventoryHold) {
    if (!canWrite) return;
    const ok = window.confirm(`¿Cancelar el apartado ${hold.folio}?`);
    if (!ok) return;
    try {
      await cancelInventoryHold(hold.id);
      setMessage(`Apartado ${hold.folio} cancelado.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar.");
    }
  }

  async function handleFulfill(hold: InventoryHold) {
    if (!canWrite) return;
    const ok = window.confirm(
      `¿Entregar el apartado ${hold.folio}?\nSe registrará una salida real por cada artículo.`
    );
    if (!ok) return;
    try {
      const session = getSession();
      if (!session?.username) {
        throw new Error("Inicia sesión para entregar el apartado.");
      }
      await fulfillInventoryHold(hold, session.username);
      setMessage(`Apartado ${hold.folio} entregado (salidas registradas).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entregar.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Apartados para proyectos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reserva mercancía cuando hay proyectos en puerta. El stock
              apartado no se puede usar en otras salidas hasta liberarlo o
              entregarlo.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <BookmarkPlus className="size-4" />
              Nuevo apartado
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          <ReadOnlyBanner visible={!canWrite} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[{ id: "activo", label: "Activos" }, ...HOLD_STATUSES.filter((s) => s.id !== "activo"), { id: "todos", label: "Todos" }].map(
            (item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  statusFilter === item.id
                    ? "border-transparent bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                {item.label}
              </button>
            )
          )}
        </div>

        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar folio, proyecto o cliente..."
            className={cn(fieldClass, "pl-9")}
          />
        </label>

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

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold text-foreground">
          Alarmas de vencimiento · 5 / 10 / 15 / 30 / 60 días
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Apartados activos según su fecha requerida del proyecto.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {dueAlerts.counts.map((bucket) => (
            <div
              key={bucket.id}
              className={cn(
                "rounded-xl border px-3 py-2",
                holdDueTone(bucket.id)
              )}
            >
              <p className="text-xs opacity-80">{bucket.label}</p>
              <p className="mt-1 text-xl font-semibold">{bucket.count}</p>
            </div>
          ))}
        </div>
        {dueAlerts.alerts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay apartados activos por vencer en los próximos 60 días.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {dueAlerts.alerts.slice(0, 12).map((hold) => (
              <li
                key={hold.id}
                className="flex flex-col gap-1 rounded-xl border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {hold.folio} · {hold.projectName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hold.clientName ? `${hold.clientName} · ` : ""}
                    requerido {hold.neededBy}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                    holdDueTone(hold.bucket)
                  )}
                >
                  {holdDueLabel(hold.daysUntil, hold.bucket)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {formOpen && canWrite ? (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <h3 className="text-base font-semibold">Nuevo apartado</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Proyecto *</span>
              <input
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ej. Instalación Hospital ABC"
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Cliente del catálogo</span>
              <select
                value={clientId}
                onChange={(e) => applyClient(e.target.value)}
                className={fieldClass}
              >
                <option value="">Escribir manualmente / sin catálogo</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.city || client.state
                      ? ` · ${locationLabel(client.city, client.state)}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Cliente</span>
              <input
                value={clientName}
                onChange={(e) => {
                  setClientId("");
                  setClientName(e.target.value);
                }}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Fecha requerida *</span>
              <input
                required
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className={fieldClass}
              />
              <span className="text-[11px] text-muted-foreground">
                Activa alertas a 5, 10, 15, 30 y 60 días.
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Estado</span>
              <select
                value={clientState}
                onChange={(e) => {
                  setClientId("");
                  setClientState(e.target.value);
                }}
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
                value={clientCity}
                onChange={(e) => {
                  setClientId("");
                  setClientCity(e.target.value);
                }}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Notas</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Artículos</h4>
              <Button
                type="button"
                variant="outline"
                className="h-8"
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      productId: "",
                      quantity: 1,
                      notes: "",
                      categoryFilter: "all",
                    },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Línea
              </Button>
            </div>
            {lines.map((line, index) => {
              const filteredItems = itemsForLine(line);
              return (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_6rem_minmax(0,1fr)_auto]"
                >
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Tipo de inventario
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
                                  productId: "",
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
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      Producto / equipo
                    </span>
                    <select
                      required
                      value={line.productId}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((row, i) =>
                            i === index
                              ? { ...row, productId: e.target.value }
                              : row
                          )
                        )
                      }
                      className={fieldClass}
                    >
                      <option value="">Selecciona</option>
                      {filteredItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} — {item.name}
                          {item.itemKind === "equipo" && item.serialNumber
                            ? ` · S/N ${item.serialNumber}`
                            : ""}{" "}
                          (disp. {availableFor(item.id)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-muted-foreground">Cant.</span>
                    <input
                      required
                      type="number"
                      min={1}
                      max={
                        line.productId
                          ? availableFor(line.productId)
                          : undefined
                      }
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
                    <span className="text-xs text-muted-foreground">Nota</span>
                    <input
                      value={line.notes ?? ""}
                      onChange={(e) =>
                        setLines((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, notes: e.target.value } : row
                          )
                        )
                      }
                      className={fieldClass}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-5 h-10"
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
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              {submitting ? "Guardando..." : "Crear apartado"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando apartados...</p>
        ) : null}

        {!loading ? (
          <>
            <ResponsiveDataList
              emptyMessage="No hay apartados con ese filtro."
              items={filtered.map((hold) => ({
                key: hold.id,
                title: hold.projectName,
                subtitle: `${hold.folio}${hold.clientName ? ` · ${hold.clientName}` : ""}${
                  hold.clientCity || hold.clientState
                    ? ` · ${locationLabel(hold.clientCity, hold.clientState)}`
                    : ""
                }`,
                badge: (
                  <div className="flex flex-wrap justify-end gap-1">
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                      {holdStatusLabel(hold.status)}
                    </span>
                    {dueBadge(hold)}
                  </div>
                ),
                fields: [
                  {
                    label: "Requerido",
                    value: hold.neededBy || "Sin fecha",
                  },
                  {
                    label: "Ubicación",
                    value:
                      locationLabel(hold.clientCity, hold.clientState) || "—",
                  },
                  {
                    label: "Líneas",
                    value: String(hold.lines.length),
                  },
                  {
                    label: "Piezas",
                    value: String(
                      hold.lines.reduce((sum, line) => sum + line.quantity, 0)
                    ),
                  },
                ],
                actions:
                  canWrite && hold.status === "activo" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs"
                        onClick={() => void handleFulfill(hold)}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Entregar
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs"
                        onClick={() => void handleRelease(hold)}
                      >
                        <Unlock className="size-3.5" />
                        Liberar
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs text-destructive"
                        onClick={() => void handleCancel(hold)}
                      >
                        <XCircle className="size-3.5" />
                        Cancelar
                      </button>
                    </div>
                  ) : undefined,
              }))}
            />

            <DesktopTable>
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Folio</th>
                    <th className="px-3 py-2 font-medium">Proyecto</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Ubicación</th>
                    <th className="px-3 py-2 font-medium">Requerido</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Artículos</th>
                    <th className="px-3 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No hay apartados con ese filtro.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((hold) => (
                      <tr key={hold.id} className="border-t border-border/70 align-top">
                        <td className="px-3 py-2 font-medium">{hold.folio}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{hold.projectName}</p>
                          {hold.notes ? (
                            <p className="text-xs text-muted-foreground">
                              {hold.notes}
                            </p>
                          ) : null}
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {hold.lines.map((line) => (
                              <li key={line.id}>
                                {line.quantity} × {line.productSku}{" "}
                                {line.productName}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-3 py-2">{hold.clientName || "—"}</td>
                        <td className="px-3 py-2">
                          {locationLabel(hold.clientCity, hold.clientState) ||
                            "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            <p>{hold.neededBy || "—"}</p>
                            {dueBadge(hold)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {holdStatusLabel(hold.status)}
                        </td>
                        <td className="px-3 py-2">{hold.lines.length}</td>
                        <td className="px-3 py-2">
                          {canWrite && hold.status === "activo" ? (
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 justify-start"
                                onClick={() => void handleFulfill(hold)}
                              >
                                Entregar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 justify-start"
                                onClick={() => void handleRelease(hold)}
                              >
                                Liberar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 justify-start text-destructive"
                                onClick={() => void handleCancel(hold)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DesktopTable>
          </>
        ) : null}
      </div>
    </section>
  );
}
