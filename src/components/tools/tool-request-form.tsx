"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Minus, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  createToolRequest,
  getOpenServiceOrdersForTools,
  resolvePerson,
  type ServiceOrderOption,
} from "@/lib/tools/storage";
import { toolCategoryLabel, type ToolRequest, type ToolWithAvailability } from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { AvailabilityPill } from "./tools-catalog";
import { fieldClass, localDateKey, Notice, primaryButtonClass, textareaClass } from "./tools-shared";

type DraftLine = { toolId: string; quantity: number };

export function ToolRequestForm({
  tools,
  session,
  today,
  onClose,
  onCreated,
}: {
  tools: ToolWithAvailability[];
  session: { username: string; fullName: string | null };
  today: Date;
  onClose: () => void;
  onCreated: (request: ToolRequest) => void;
}) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [expectedReturnAt, setExpectedReturnAt] = useState(() => localDateKey(today, 1));
  const [notes, setNotes] = useState("");
  const [orders, setOrders] = useState<ServiceOrderOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getOpenServiceOrdersForTools()
      .then((list) => {
        if (active) setOrders(list);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const byId = useMemo(() => new Map(tools.map((tool) => [tool.id, tool])), [tools]);
  const requestable = useMemo(
    () => tools.filter((tool) => tool.isActive && tool.condition !== "baja" && tool.quantityTotal > 0),
    [tools]
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosen = new Set(lines.map((line) => line.toolId));
    return requestable
      .filter((tool) => !chosen.has(tool.id))
      .filter(
        (tool) =>
          !q ||
          [tool.code, tool.name, tool.brand, tool.model, toolCategoryLabel(tool.category)]
            .join(" ")
            .toLowerCase()
            .includes(q)
      )
      .slice(0, 8);
  }, [requestable, query, lines]);

  function addTool(tool: ToolWithAvailability) {
    setLines((current) => [...current, { toolId: tool.id, quantity: 1 }]);
    setQuery("");
  }

  function setQuantity(toolId: string, quantity: number) {
    const tool = byId.get(toolId);
    const max = tool?.quantityTotal ?? 1;
    setLines((current) =>
      current.map((line) =>
        line.toolId === toolId ? { ...line, quantity: Math.min(max, Math.max(1, Math.round(quantity) || 1)) } : line
      )
    );
  }

  const shortages = lines.filter((line) => line.quantity > (byId.get(line.toolId)?.quantityAvailable ?? 0));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const requester = await resolvePerson(session);
      const created = await createToolRequest({
        purpose,
        serviceOrderId: serviceOrderId || null,
        expectedReturnAt,
        notes,
        requester,
        lines,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Solicitar herramientas a almacén"
      description="Se genera un vale con folio. Almacén confirma la entrega y registra la devolución en el mismo vale."
      className="max-w-4xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Herramientas</p>
          <label className="relative block">
            <span className="sr-only">Buscar en el catálogo</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(fieldClass, "pl-9")}
              placeholder={
                requestable.length
                  ? "Busca en el catálogo: desarmador, llave, multímetro…"
                  : "Almacén aún no registra herramientas"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!requestable.length}
            />
          </label>
          {results.length && (query || !lines.length) ? (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {results.map((tool) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => addTool(tool)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                  >
                    <Plus className="size-4 shrink-0 text-[#3B46A5]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{tool.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {tool.code} · {toolCategoryLabel(tool.category)}
                        {tool.brand ? ` · ${tool.brand}` : ""}
                        {tool.location ? ` · ${tool.location}` : ""}
                      </span>
                    </span>
                    <AvailabilityPill tool={tool} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {lines.length ? (
            <ul className="space-y-2">
              {lines.map((line) => {
                const tool = byId.get(line.toolId);
                if (!tool) return null;
                const short = line.quantity > tool.quantityAvailable;
                return (
                  <li
                    key={line.toolId}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3",
                      short ? "border-amber-500/40" : "border-border"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{tool.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {tool.code} · {tool.quantityAvailable} disponibles de {tool.quantityTotal}
                      </span>
                    </span>
                    <span className="inline-flex items-center rounded-lg border border-input">
                      <button
                        type="button"
                        className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => setQuantity(line.toolId, line.quantity - 1)}
                        aria-label="Quitar una pieza"
                      >
                        <Minus className="size-4" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={tool.quantityTotal}
                        aria-label={`Piezas de ${tool.name}`}
                        className="h-9 w-12 border-x border-input bg-transparent text-center text-sm tabular-nums outline-none"
                        value={line.quantity}
                        onChange={(e) => setQuantity(line.toolId, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => setQuantity(line.toolId, line.quantity + 1)}
                        aria-label="Agregar una pieza"
                      >
                        <Plus className="size-4" />
                      </button>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ${tool.name}`}
                      onClick={() => setLines((current) => current.filter((l) => l.toolId !== line.toolId))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Busca y agrega las herramientas que necesitas.</p>
          )}
          {shortages.length ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Algunas piezas están prestadas en este momento. Puedes enviar la solicitud; almacén entregará
              lo que tenga disponible.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">¿Para qué las necesitas? *</span>
            <input
              className={fieldClass}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Ej. Mantenimiento preventivo de máquina de anestesia en Hospital Militar"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Orden de servicio (opcional)</span>
            <select className={fieldClass} value={serviceOrderId} onChange={(e) => setServiceOrderId(e.target.value)}>
              <option value="">Sin orden vinculada</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.folio} · {order.clientName || "Sin cliente"}
                  {order.equipmentName ? ` · ${order.equipmentName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Fecha de devolución comprometida *</span>
            <input
              type="date"
              className={fieldClass}
              min={localDateKey(today)}
              value={expectedReturnAt}
              onChange={(e) => setExpectedReturnAt(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Notas para almacén</span>
            <textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <Notice tone="error">{error}</Notice>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Solicita: {session.fullName || session.username}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-10 px-3" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !lines.length}
              className={cn("h-10 px-4", primaryButtonClass)}
            >
              {saving ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
