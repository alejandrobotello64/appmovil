"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ExternalLink,
  FileUp,
  Gavel,
  Plus,
  Search,
  Trash2,
  BookmarkPlus,
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
import {
  addTenderNote,
  convertTenderToHold,
  createTender,
  deleteTender,
  deleteTenderDocument,
  getTenders,
  replaceTenderLines,
  setTenderStatus,
  updateTender,
  uploadTenderDocument,
} from "@/lib/tenders/storage";
import {
  TENDER_CHARACTERS,
  TENDER_COMPLIANCE,
  TENDER_DOC_TYPES,
  TENDER_PIPELINE_STATUSES,
  TENDER_PROCEDURES,
  TENDER_STATUSES,
  lineImporte,
  tenderDocTypeLabel,
  tenderLinesTotal,
  tenderProcedureLabel,
  tenderStatusLabel,
  type Tender,
  type TenderDocType,
  type TenderInput,
  type TenderLineInput,
  type TenderStatus,
} from "@/lib/tenders/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

type DraftLine = TenderLineInput & {
  key: string;
  categoryFilter: InventoryCategoryId | "all";
};

const EMPTY_FORM: TenderInput = {
  folioComprasmx: "",
  urlComprasmx: "",
  title: "",
  description: "",
  convocante: "",
  clientId: null,
  state: "",
  city: "",
  procedimiento: "LP",
  caracter: "federal",
  status: "prospecto",
  publishedAt: "",
  juntaAclaraciones: "",
  limitePreguntas: "",
  limitePropuestas: "",
  falloAt: "",
  firmaAt: "",
  montoEstimado: 0,
  montoOfertado: 0,
  responsableNombre: "",
  probabilidad: 50,
  notes: "",
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
  if (days <= 5) return "text-rose-700 dark:text-rose-300";
  if (days <= 15) return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
}

export function TendersPanel() {
  const { canWrite } = usePermissions("licitaciones");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("abiertas");
  const [view, setView] = useState<"tablero" | "lista">("tablero");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tender | null>(null);
  const [form, setForm] = useState<TenderInput>(EMPTY_FORM);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [docType, setDocType] = useState<TenderDocType>("bases");
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [tenderRows, clientRows, catalog] = await Promise.all([
        getTenders(),
        getClients(),
        getInventoryItems(),
      ]);
      setTenders(tenderRows);
      setClients(clientRows.filter((client) => client.isActive));
      setItems(catalog);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar licitaciones."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selected = useMemo(
    () => tenders.find((item) => item.id === selectedId) ?? null,
    [tenders, selectedId]
  );

  const filtered = useMemo(() => {
    let rows = tenders;
    if (statusFilter === "abiertas") {
      rows = rows.filter(
        (item) =>
          !["ganada", "perdida", "desierta", "cancelada"].includes(item.status)
      );
    } else if (statusFilter !== "todos") {
      rows = rows.filter((item) => item.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((item) =>
        [
          item.folioInterno,
          item.folioComprasmx,
          item.title,
          item.convocante,
          item.city,
          item.state,
          item.responsableNombre,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [tenders, statusFilter, search]);

  const stats = useMemo(() => {
    const open = tenders.filter(
      (item) =>
        !["ganada", "perdida", "desierta", "cancelada"].includes(item.status)
    );
    const dueSoon = open.filter((item) => {
      const days = daysUntilExpiry(item.limitePropuestas);
      return days !== null && days >= 0 && days <= 7;
    });
    const won = tenders.filter((item) => item.status === "ganada");
    const offeredMonth = tenders
      .filter((item) => item.updatedAt.slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((sum, item) => sum + item.montoOfertado, 0);
    return {
      open: open.length,
      dueSoon: dueSoon.length,
      won: won.length,
      offeredMonth,
    };
  }, [tenders]);

  function itemsForLine(line: DraftLine) {
    if (line.categoryFilter === "all") return items;
    return items.filter((item) => item.category === line.categoryFilter);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setLines([
      {
        key: crypto.randomUUID(),
        descripcion: "",
        quantity: 1,
        unitPrice: 0,
        unit: "pza",
        cumpleEspec: "si",
        categoryFilter: "all",
        productId: null,
      },
    ]);
    setFormOpen(true);
  }

  function openEdit(tender: Tender) {
    setEditing(tender);
    setForm({
      folioComprasmx: tender.folioComprasmx,
      urlComprasmx: tender.urlComprasmx,
      title: tender.title,
      description: tender.description,
      convocante: tender.convocante,
      clientId: tender.clientId,
      state: tender.state,
      city: tender.city,
      procedimiento: tender.procedimiento,
      caracter: tender.caracter,
      status: tender.status,
      publishedAt: tender.publishedAt,
      juntaAclaraciones: tender.juntaAclaraciones,
      limitePreguntas: tender.limitePreguntas,
      limitePropuestas: tender.limitePropuestas,
      falloAt: tender.falloAt,
      firmaAt: tender.firmaAt,
      montoEstimado: tender.montoEstimado,
      montoOfertado: tender.montoOfertado,
      responsableNombre: tender.responsableNombre,
      probabilidad: tender.probabilidad,
      notes: tender.notes,
    });
    setLines(
      tender.lines.length
        ? tender.lines.map((line) => ({
            key: line.id,
            clavePartida: line.clavePartida,
            descripcion: line.descripcion,
            productId: line.productId,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            cumpleEspec: line.cumpleEspec,
            notaTecnica: line.notaTecnica,
            categoryFilter: "all" as const,
          }))
        : [
            {
              key: crypto.randomUUID(),
              descripcion: "",
              quantity: 1,
              unitPrice: 0,
              unit: "pza",
              cumpleEspec: "si" as const,
              categoryFilter: "all" as const,
              productId: null,
            },
          ]
    );
    setFormOpen(true);
    setSelectedId(tender.id);
  }

  function applyClient(clientId: string) {
    const client = clients.find((row) => row.id === clientId);
    setForm((prev) => ({
      ...prev,
      clientId: clientId || null,
      convocante: client?.name ?? prev.convocante,
      city: client?.city ?? prev.city,
      state: client?.state ?? prev.state,
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
        (line) => line.descripcion.trim() && line.quantity > 0
      );
      const offered = validLines.reduce(
        (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
        0
      );
      const payload: TenderInput = {
        ...form,
        montoOfertado: offered || form.montoOfertado,
        createdBy: session?.username ?? "",
        lines: validLines,
      };

      let saved: Tender;
      if (editing) {
        saved = await updateTender(editing.id, payload);
        await replaceTenderLines(editing.id, validLines);
        saved = (await getTenders()).find((item) => item.id === editing.id)!;
      } else {
        saved = await createTender(payload);
      }
      setMessage(`Licitación ${saved.folioInterno} guardada.`);
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

  async function handleStatus(tender: Tender, status: TenderStatus) {
    if (!canWrite) return;
    try {
      await setTenderStatus(tender.id, status, getSession()?.username ?? "");
      setMessage(`Estatus actualizado a ${tenderStatusLabel(status)}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar estatus.");
    }
  }

  async function handleDelete(tender: Tender) {
    if (!canWrite) return;
    const ok = window.confirm(`¿Eliminar la licitación ${tender.folioInterno}?`);
    if (!ok) return;
    try {
      await deleteTender(tender.id);
      if (selectedId === tender.id) setSelectedId(null);
      setMessage("Licitación eliminada.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function handleNote(tender: Tender) {
    if (!canWrite || !noteText.trim()) return;
    try {
      await addTenderNote(tender.id, noteText, getSession()?.username ?? "");
      setNoteText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la nota.");
    }
  }

  async function handleUpload(tender: Tender) {
    if (!canWrite || !docFile) {
      setError("Selecciona un archivo.");
      return;
    }
    try {
      await uploadTenderDocument({
        tenderId: tender.id,
        docType,
        name: docName || docFile.name,
        file: docFile,
        uploadedBy: getSession()?.username ?? "",
      });
      setDocFile(null);
      setDocName("");
      setMessage("Documento cargado.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo subir el documento."
      );
    }
  }

  async function handleConvert(tender: Tender) {
    if (!canWrite) return;
    const ok = window.confirm(
      `¿Crear apartado de proyecto desde ${tender.folioInterno}?`
    );
    if (!ok) return;
    try {
      const hold = await convertTenderToHold(
        tender,
        getSession()?.username ?? ""
      );
      setMessage(`Apartado ${hold.folio} creado desde la licitación.`);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el apartado."
      );
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Licitaciones CompraMX</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Expediente interno de procedimientos en los que participamos.
              CompraMX sigue siendo la fuente oficial.
            </p>
          </div>
          {canWrite ? (
            <Button
              onClick={openCreate}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <Plus className="size-4" />
              Nueva licitación
            </Button>
          ) : null}
        </div>
        <div className="mt-4">
          <ReadOnlyBanner visible={!canWrite} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Abiertas</p>
            <p className="text-xl font-semibold">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Vencen en 7 días</p>
            <p className="text-xl font-semibold">{stats.dueSoon}</p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Ganadas</p>
            <p className="text-xl font-semibold">{stats.won}</p>
          </div>
          <div className="rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Ofertado del mes</p>
            <p className="text-lg font-semibold">{money(stats.offeredMonth)}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar folio CompraMX, título, convocante..."
              className={cn(fieldClass, "pl-9")}
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={cn(fieldClass, "sm:w-48")}
          >
            <option value="abiertas">Abiertas</option>
            <option value="todos">Todos</option>
            {TENDER_STATUSES.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setView("tablero")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                view === "tablero"
                  ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  : "text-muted-foreground"
              )}
            >
              Tablero
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                view === "lista"
                  ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  : "text-muted-foreground"
              )}
            >
              Lista
            </button>
          </div>
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
            {editing ? `Editar ${editing.folioInterno}` : "Nueva licitación"}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Título *</span>
              <input
                required
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Folio CompraMX *</span>
              <input
                required
                value={form.folioComprasmx}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    folioComprasmx: e.target.value,
                  }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">URL CompraMX</span>
              <input
                value={form.urlComprasmx}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, urlComprasmx: e.target.value }))
                }
                placeholder="https://..."
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
                <option value="">Sin vínculo / manual</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Convocante</span>
              <input
                value={form.convocante}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, convocante: e.target.value }))
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
              <span className="text-sm font-medium">Procedimiento</span>
              <select
                value={form.procedimiento}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    procedimiento: e.target.value as TenderInput["procedimiento"],
                  }))
                }
                className={fieldClass}
              >
                {TENDER_PROCEDURES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Carácter</span>
              <select
                value={form.caracter}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    caracter: e.target.value as TenderInput["caracter"],
                  }))
                }
                className={fieldClass}
              >
                {TENDER_CHARACTERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Estatus</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as TenderStatus,
                  }))
                }
                className={fieldClass}
              >
                {TENDER_STATUSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Responsable</span>
              <input
                value={form.responsableNombre}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    responsableNombre: e.target.value,
                  }))
                }
                className={fieldClass}
              />
            </label>
            {(
              [
                ["publishedAt", "Publicación"],
                ["juntaAclaraciones", "Junta aclaraciones"],
                ["limitePreguntas", "Límite preguntas"],
                ["limitePropuestas", "Límite propuestas"],
                ["falloAt", "Fallo"],
                ["firmaAt", "Firma"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1.5">
                <span className="text-sm font-medium">{label}</span>
                <input
                  type="date"
                  value={form[key] ?? ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className={fieldClass}
                />
              </label>
            ))}
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Monto estimado</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.montoEstimado}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    montoEstimado: Number(e.target.value),
                  }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Probabilidad %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.probabilidad}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    probabilidad: Number(e.target.value),
                  }))
                }
                className={fieldClass}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium">Notas</span>
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
                      descripcion: "",
                      quantity: 1,
                      unitPrice: 0,
                      unit: "pza",
                      cumpleEspec: "si",
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
                <label className="space-y-1 lg:col-span-2">
                  <span className="text-xs text-muted-foreground">
                    Descripción *
                  </span>
                  <input
                    required
                    value={line.descripcion}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, descripcion: e.target.value }
                            : row
                        )
                      )
                    }
                    className={fieldClass}
                  />
                </label>
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
                                unit: product?.unit || row.unit,
                                unitPrice:
                                  product?.unitPrice ?? row.unitPrice,
                                descripcion:
                                  row.descripcion || product?.name || "",
                              }
                            : row
                        )
                      );
                    }}
                    className={fieldClass}
                  >
                    <option value="">Sin vínculo</option>
                    {itemsForLine(line).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} — {item.name}
                      </option>
                    ))}
                  </select>
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
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Cumple</span>
                  <select
                    value={line.cumpleEspec}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                cumpleEspec: e.target
                                  .value as DraftLine["cumpleEspec"],
                              }
                            : row
                        )
                      )
                    }
                    className={fieldClass}
                  >
                    {TENDER_COMPLIANCE.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end justify-between gap-2 lg:col-span-5">
                  <p className="text-sm text-muted-foreground">
                    Importe: {money(lineImporte(line))}
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
            <p className="text-sm font-medium">
              Total partidas:{" "}
              {money(
                lines.reduce(
                  (sum, line) =>
                    sum + Number(line.quantity) * Number(line.unitPrice),
                  0
                )
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              {submitting ? "Guardando..." : "Guardar"}
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
        <p className="text-sm text-muted-foreground">Cargando licitaciones...</p>
      ) : null}

      {!loading && view === "tablero" ? (
        <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-6">
          {TENDER_PIPELINE_STATUSES.map((statusId) => {
            const column = filtered.filter((item) => item.status === statusId);
            return (
              <div
                key={statusId}
                className="rounded-2xl border border-border bg-card p-3 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {tenderStatusLabel(statusId)}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {column.length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {column.map((tender) => (
                    <li key={tender.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(tender.id)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/50",
                          selectedId === tender.id
                            ? "border-[#3B46A5] bg-muted/40"
                            : "border-border"
                        )}
                      >
                        <p className="text-xs text-muted-foreground">
                          {tender.folioInterno}
                        </p>
                        <p className="text-sm font-medium leading-snug">
                          {tender.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tender.convocante || "Sin convocante"}
                        </p>
                        {tender.limitePropuestas ? (
                          <p
                            className={cn(
                              "mt-1 text-xs font-medium",
                              dueTone(tender.limitePropuestas)
                            )}
                          >
                            Propuestas: {tender.limitePropuestas}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs font-medium">
                          {money(tender.montoOfertado || tenderLinesTotal(tender.lines))}
                        </p>
                      </button>
                    </li>
                  ))}
                  {column.length === 0 ? (
                    <li className="px-1 py-4 text-center text-xs text-muted-foreground">
                      Vacío
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && view === "lista" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Folio</th>
                <th className="px-3 py-2 font-medium">Título</th>
                <th className="px-3 py-2 font-medium">Convocante</th>
                <th className="px-3 py-2 font-medium">Estatus</th>
                <th className="px-3 py-2 font-medium">Propuestas</th>
                <th className="px-3 py-2 font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No hay licitaciones con ese filtro.
                  </td>
                </tr>
              ) : (
                filtered.map((tender) => (
                  <tr
                    key={tender.id}
                    className="cursor-pointer border-t border-border/70 hover:bg-muted/30"
                    onClick={() => setSelectedId(tender.id)}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{tender.folioInterno}</p>
                      <p className="text-xs text-muted-foreground">
                        {tender.folioComprasmx}
                      </p>
                    </td>
                    <td className="px-3 py-2">{tender.title}</td>
                    <td className="px-3 py-2">{tender.convocante || "—"}</td>
                    <td className="px-3 py-2">
                      {tenderStatusLabel(tender.status)}
                    </td>
                    <td className={cn("px-3 py-2", dueTone(tender.limitePropuestas))}>
                      {tender.limitePropuestas || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {money(
                        tender.montoOfertado || tenderLinesTotal(tender.lines)
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {selected ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Gavel className="size-4 text-[#3B46A5]" />
                <h3 className="text-lg font-semibold">{selected.title}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.folioInterno} · CompraMX {selected.folioComprasmx} ·{" "}
                {tenderProcedureLabel(selected.procedimiento)} ·{" "}
                {tenderStatusLabel(selected.status)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {[selected.convocante, selected.city, selected.state]
                  .filter(Boolean)
                  .join(" · ") || "Sin ubicación"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.urlComprasmx ? (
                <a
                  href={selected.urlComprasmx}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs"
                >
                  <ExternalLink className="size-3.5" />
                  Abrir CompraMX
                </a>
              ) : null}
              {canWrite ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => openEdit(selected)}
                  >
                    Editar
                  </Button>
                  {selected.status === "ganada" && !selected.holdId ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => void handleConvert(selected)}
                    >
                      <BookmarkPlus className="size-3.5" />
                      Crear apartado
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-destructive"
                    onClick={() => void handleDelete(selected)}
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              {TENDER_STATUSES.map((status) => (
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["Publicación", selected.publishedAt],
                ["Junta aclaraciones", selected.juntaAclaraciones],
                ["Límite preguntas", selected.limitePreguntas],
                ["Límite propuestas", selected.limitePropuestas],
                ["Fallo", selected.falloAt],
                ["Firma", selected.firmaAt],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border px-3 py-2"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("text-sm font-medium", dueTone(value))}>
                  {value || "—"}
                </p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-semibold">Partidas</h4>
            <ul className="mt-2 space-y-2">
              {selected.lines.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  Sin partidas registradas.
                </li>
              ) : (
                selected.lines.map((line) => (
                  <li
                    key={line.id}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {line.clavePartida
                            ? `${line.clavePartida} · `
                            : ""}
                          {line.descripcion}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {line.productSku
                            ? `${line.productSku} · ${line.productName}`
                            : "Sin SKU"}{" "}
                          · {line.quantity} {line.unit} ·{" "}
                          {TENDER_COMPLIANCE.find(
                            (item) => item.id === line.cumpleEspec
                          )?.label}
                        </p>
                      </div>
                      <p className="font-medium">{money(lineImporte(line))}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-2 text-sm font-semibold">
              Total:{" "}
              {money(
                selected.montoOfertado || tenderLinesTotal(selected.lines)
              )}
            </p>
            {selected.holdId ? (
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Apartado vinculado: {selected.holdId}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h4 className="font-semibold">Documentos</h4>
              <ul className="mt-2 space-y-2">
                {selected.documents.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    Sin documentos.
                  </li>
                ) : (
                  selected.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tenderDocTypeLabel(doc.docType)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {doc.fileUrl ? (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-border px-2 py-1 text-xs"
                          >
                            Ver
                          </a>
                        ) : null}
                        {canWrite ? (
                          <button
                            type="button"
                            className="rounded-lg border border-destructive/30 px-2 py-1 text-xs text-destructive"
                            onClick={() =>
                              void deleteTenderDocument(doc).then(refresh)
                            }
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))
                )}
              </ul>
              {canWrite ? (
                <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border p-3">
                  <select
                    value={docType}
                    onChange={(e) =>
                      setDocType(e.target.value as TenderDocType)
                    }
                    className={fieldClass}
                  >
                    {TENDER_DOC_TYPES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Nombre del documento"
                    className={fieldClass}
                  />
                  <input
                    type="file"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => void handleUpload(selected)}
                  >
                    <FileUp className="size-3.5" />
                    Subir
                  </Button>
                </div>
              ) : null}
            </div>

            <div>
              <h4 className="font-semibold">Bitácora</h4>
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {selected.events.length === 0 ? (
                  <li className="text-sm text-muted-foreground">Sin eventos.</li>
                ) : (
                  selected.events.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <p>{event.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString("es-MX")}
                        {event.createdBy ? ` · ${event.createdBy}` : ""}
                      </p>
                    </li>
                  ))
                )}
              </ul>
              {canWrite ? (
                <div className="mt-3 flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Agregar nota..."
                    className={fieldClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0"
                    onClick={() => void handleNote(selected)}
                  >
                    Nota
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
