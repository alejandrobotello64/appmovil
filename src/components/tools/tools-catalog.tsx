"use client";

import { useMemo, useState, type FormEvent } from "react";
import { History, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { deleteTool, saveTool } from "@/lib/tools/storage";
import {
  lineOutstanding,
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  toolCategoryLabel,
  toolConditionLabel,
  type ToolCategory,
  type ToolInput,
  type ToolRequest,
  type ToolWithAvailability,
} from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import {
  fieldClass,
  formatDate,
  Notice,
  primaryButtonClass,
  StatusBadge,
  textareaClass,
} from "./tools-shared";

function emptyInput(): ToolInput {
  return {
    code: "",
    name: "",
    category: "desarmador",
    brand: "",
    model: "",
    serialNumber: "",
    description: "",
    location: "",
    quantityTotal: 1,
    condition: "bueno",
    isActive: true,
    notes: "",
  };
}

function toInput(tool: ToolWithAvailability): ToolInput {
  return {
    code: tool.code,
    name: tool.name,
    category: tool.category,
    brand: tool.brand,
    model: tool.model,
    serialNumber: tool.serialNumber,
    description: tool.description,
    location: tool.location,
    quantityTotal: tool.quantityTotal,
    condition: tool.condition,
    isActive: tool.isActive,
    notes: tool.notes,
  };
}

export function AvailabilityPill({ tool }: { tool: ToolWithAvailability }) {
  const unusable = !tool.isActive || tool.condition === "baja";
  const tone = unusable
    ? "bg-muted text-muted-foreground"
    : tool.quantityAvailable === 0
      ? "bg-destructive/10 text-destructive"
      : tool.quantityOut > 0
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  const text = unusable
    ? tool.isActive
      ? "De baja"
      : "Inactiva"
    : tool.quantityAvailable === 0
      ? "Sin disponibles"
      : `${tool.quantityAvailable} de ${tool.quantityTotal} disponibles`;
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone)}>
      {text}
    </span>
  );
}

export function ToolsCatalog({
  tools,
  requests,
  canCreate,
  canEdit,
  canDelete,
  actor,
  onChanged,
  onOpenRequest,
}: {
  tools: ToolWithAvailability[];
  requests: ToolRequest[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  actor: string;
  onChanged: () => void;
  onOpenRequest: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | "todas">("todas");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [editing, setEditing] = useState<ToolWithAvailability | "new" | null>(null);
  const [historyFor, setHistoryFor] = useState<ToolWithAvailability | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (category !== "todas" && tool.category !== category) return false;
      if (onlyAvailable && tool.quantityAvailable === 0) return false;
      if (!q) return true;
      return [tool.code, tool.name, tool.brand, tool.model, tool.serialNumber, tool.location, tool.description]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [tools, query, category, onlyAvailable]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const tool of tools) map.set(tool.category, (map.get(tool.category) ?? 0) + 1);
    return map;
  }, [tools]);

  async function onDelete(tool: ToolWithAvailability) {
    if (!window.confirm(`¿Eliminar «${tool.name}» del catálogo? Los vales anteriores conservan su registro.`)) return;
    try {
      setError("");
      await deleteTool(tool.id);
      setMessage(`${tool.name} se eliminó del catálogo.`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar herramienta</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(fieldClass, "pl-9")}
            placeholder="Buscar por nombre, código, marca, serie o ubicación"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          Solo disponibles
        </label>
        {canCreate ? (
          <Button type="button" className={cn("h-10 px-3", primaryButtonClass)} onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Nueva herramienta
          </Button>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: "todas" as const, label: "Todas" }, ...TOOL_CATEGORIES].map((item) => {
          const count = item.id === "todas" ? tools.length : counts.get(item.id) ?? 0;
          if (item.id !== "todas" && !count) return null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              aria-pressed={category === item.id}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                category === item.id
                  ? "border-[#3B46A5] bg-[#3B46A5] text-white"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{message}</Notice>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {tools.length === 0
            ? canCreate
              ? "Aún no hay herramientas. Da de alta la primera con «Nueva herramienta»."
              : "Almacén aún no registra herramientas en el catálogo."
            : "Ninguna herramienta coincide con la búsqueda."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tool) => (
            <article
              key={tool.id}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm",
                (!tool.isActive || tool.condition === "baja") && "opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-[#00BFFF] uppercase">
                    {tool.code} · {toolCategoryLabel(tool.category)}
                  </p>
                  <h3 className="truncate text-sm font-semibold">{tool.name}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {[tool.brand, tool.model].filter(Boolean).join(" · ") || "Sin marca"}
                    {tool.serialNumber ? ` · S/N ${tool.serialNumber}` : ""}
                  </p>
                </div>
                <AvailabilityPill tool={tool} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Estado: {toolConditionLabel(tool.condition)}</span>
                {tool.location ? <span>Ubicación: {tool.location}</span> : null}
                {tool.quantityOut ? <span className="text-amber-700 dark:text-amber-300">{tool.quantityOut} prestadas</span> : null}
              </div>
              {tool.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setHistoryFor(tool)}>
                  <History className="size-3.5" /> Historial
                </Button>
                {canEdit ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(tool)}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button type="button" variant="destructive" size="sm" onClick={() => void onDelete(tool)}>
                    <Trash2 className="size-3.5" /> Eliminar
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing ? (
        <ToolForm
          tool={editing === "new" ? null : editing}
          actor={actor}
          onClose={() => setEditing(null)}
          onSaved={(name, isNew) => {
            setEditing(null);
            setError("");
            setMessage(isNew ? `${name} se agregó al catálogo.` : `${name} se actualizó.`);
            onChanged();
          }}
        />
      ) : null}

      {historyFor ? (
        <ToolHistory
          tool={historyFor}
          requests={requests}
          onClose={() => setHistoryFor(null)}
          onOpenRequest={(id) => {
            setHistoryFor(null);
            onOpenRequest(id);
          }}
        />
      ) : null}
    </section>
  );
}

function ToolForm({
  tool,
  actor,
  onClose,
  onSaved,
}: {
  tool: ToolWithAvailability | null;
  actor: string;
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
}) {
  const [form, setForm] = useState<ToolInput>(() => (tool ? toInput(tool) : emptyInput()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof ToolInput>(key: K, value: ToolInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveTool(tool?.id ?? null, form, actor);
      onSaved(form.name.trim(), !tool);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={tool ? `Editar ${tool.code}` : "Nueva herramienta"}
      description="Registra desarmadores, llaves, pinzas, equipo de medición y demás herramientas del almacén."
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Nombre *</span>
          <input
            className={fieldClass}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Ej. Juego de desarmadores de precisión"
            required
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Categoría</span>
          <select
            className={fieldClass}
            value={form.category}
            onChange={(e) => set("category", e.target.value as ToolCategory)}
          >
            {TOOL_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Código</span>
          <input
            className={fieldClass}
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder={tool ? "" : "Automático (HER-0001)"}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Marca</span>
          <input className={fieldClass} value={form.brand} onChange={(e) => set("brand", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Modelo</span>
          <input className={fieldClass} value={form.model} onChange={(e) => set("model", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Número de serie</span>
          <input
            className={fieldClass}
            value={form.serialNumber}
            onChange={(e) => set("serialNumber", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Ubicación en almacén</span>
          <input
            className={fieldClass}
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Ej. Gaveta 3, anaquel B"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Piezas en existencia</span>
          <input
            type="number"
            min={tool?.quantityOut ?? 0}
            step={1}
            className={fieldClass}
            value={form.quantityTotal}
            onChange={(e) => set("quantityTotal", Math.max(0, Math.round(Number(e.target.value) || 0)))}
          />
          {tool?.quantityOut ? (
            <span className="mt-1 block text-xs text-muted-foreground">{tool.quantityOut} prestadas ahora</span>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Estado</span>
          <select
            className={fieldClass}
            value={form.condition}
            onChange={(e) => set("condition", e.target.value as ToolInput["condition"])}
          >
            {TOOL_CONDITIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Descripción</span>
          <textarea
            className={textareaClass}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Medidas, puntas incluidas, accesorios del estuche…"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted-foreground">Notas internas</span>
          <input className={fieldClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </label>
        <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Activa (se puede solicitar)
        </label>

        <div className="sm:col-span-2">
          <Notice tone="error">{error}</Notice>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" className="h-10 px-3" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving} className={cn("h-10 px-4", primaryButtonClass)}>
            {saving ? "Guardando…" : tool ? "Guardar cambios" : "Agregar al catálogo"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function ToolHistory({
  tool,
  requests,
  onClose,
  onOpenRequest,
}: {
  tool: ToolWithAvailability;
  requests: ToolRequest[];
  onClose: () => void;
  onOpenRequest: (id: string) => void;
}) {
  const rows = requests
    .map((request) => ({ request, line: request.lines.find((line) => line.toolId === tool.id) }))
    .filter((row): row is { request: ToolRequest; line: NonNullable<typeof row.line> } => Boolean(row.line));

  return (
    <ModalShell
      title={`Historial · ${tool.name}`}
      description={`${tool.code} · ${rows.length} vale(s) donde se ha solicitado`}
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta herramienta aún no se ha solicitado.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(({ request, line }) => (
            <li key={request.id}>
              <button
                type="button"
                onClick={() => onOpenRequest(request.id)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left hover:bg-muted/40"
              >
                <span className="font-medium">{request.folio}</span>
                <StatusBadge status={request.status} />
                <span className="text-sm text-muted-foreground">{request.requester.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {line.quantityRequested} solicitadas · {line.quantityDelivered} entregadas
                  {lineOutstanding(line) ? ` · ${lineOutstanding(line)} fuera` : ""} ·{" "}
                  {formatDate(request.requestedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
